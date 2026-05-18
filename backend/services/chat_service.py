"""Chat orchestrator: persist user → load history → retrieve+rerank →
emit sources → stream Claude → persist assistant → auto-title → done."""
import json
import re

import aiosqlite

from backend.routers.threads import db_append_message, db_set_thread_title
from backend.services import sse
from src.config import DENSE_TOP_K, RERANK_TOP_K
from src.generate import CITATION_PATTERN


def _chunk_to_source(c: dict) -> dict:
    """Project only safe-to-wire fields for the SSE sources frame.
    Full text is fetched on demand via /api/chunks/{id}."""
    return {
        "chunk_id": c["chunk_id"],
        "ticker": c["ticker"],
        "item": c["item"],
        "section_title": c.get("section_title", ""),
        "rerank_score": float(c.get("rerank_score", 0.0)),
        "retrieval_score": float(c.get("retrieval_score", 0.0)),
        "text_preview": c["text"][:300],
    }


def _build_history_messages(prior: list) -> list[dict]:
    """Convert DB Message rows to Anthropic message dicts. Skips system; only
    user+assistant text. Sources are NOT included in the assistant content sent
    back to the model (they were already retrieved fresh for each turn)."""
    return [{"role": m.role, "content": m.content} for m in prior]


def _title_from(query: str, max_chars: int = 60) -> str:
    """Trim the user's first message to a thread title at a word boundary."""
    q = query.strip().replace("\n", " ")
    q = re.sub(r"\s+", " ", q)
    if len(q) <= max_chars:
        return q
    truncated = q[:max_chars]
    # Trim back to last word boundary
    last_space = truncated.rfind(" ")
    if last_space > 0:
        truncated = truncated[:last_space]
    return truncated.rstrip(",.;:!?") + "…"


async def stream_chat(
    thread_id: str,
    user_content: str,
    ticker_filter: list[str] | None,
    top_k_rerank: int | None,
    pipeline,
    db: aiosqlite.Connection,
):
    """Async generator yielding SSE-encoded bytes for one chat turn.

    Persists both halves of the turn (user message before streaming starts,
    assistant message after the stream completes)."""
    # 1. Persist user message + grab prior history (excluding the just-inserted user msg)
    # Load history BEFORE inserting so the stream-time "history" is conversation-to-date.
    from backend.routers.threads import _row_to_message  # internal helper

    async with db.execute(
        "SELECT id, role, content, sources_json, created_at, seq "
        "FROM messages WHERE thread_id = ? ORDER BY seq ASC",
        (thread_id,),
    ) as cur:
        prior_rows = await cur.fetchall()
    prior = [_row_to_message(r) for r in prior_rows]
    is_first_turn = len(prior) == 0

    await db_append_message(db, thread_id, "user", user_content)

    # 2. Retrieve + rerank (apply ticker filter if present)
    ticker_set = set(ticker_filter) if ticker_filter else None
    candidates = pipeline.retriever.retrieve(
        user_content, k=DENSE_TOP_K, ticker_filter=ticker_set
    )
    top_k = top_k_rerank or RERANK_TOP_K
    reranked = pipeline.reranker.rerank(user_content, candidates, top_k=top_k)

    # 3. Emit sources FIRST (so the UI mounts the panel before text streams in)
    yield sse.data_part(
        "sources", {"chunks": [_chunk_to_source(c) for c in reranked]}
    )

    # 4. Stream Claude
    history_msgs = _build_history_messages(prior)
    accumulated: list[str] = []
    final = None
    try:
        with pipeline.generator.stream_chat(
            query=user_content,
            chunks=reranked,
            history=history_msgs,
        ) as stream:
            for text in stream.text_stream:
                accumulated.append(text)
                yield sse.text_delta(text)
            final = stream.get_final_message()
    except Exception as e:  # surface any model/network error to the client
        yield sse.error(f"{type(e).__name__}: {e}")
        return

    # 5. Persist assistant message + sources
    full_answer = "".join(accumulated)
    citations = sorted(set(CITATION_PATTERN.findall(full_answer)))
    sources_payload = {
        "chunks": [_chunk_to_source(c) for c in reranked],
        "citations": citations,
    }
    await db_append_message(
        db,
        thread_id,
        "assistant",
        content=full_answer,
        sources_json=json.dumps(sources_payload),
    )

    # 6. Auto-title on first turn
    if is_first_turn:
        await db_set_thread_title(db, thread_id, _title_from(user_content))

    # 7. Done
    usage = {}
    if final is not None and getattr(final, "usage", None):
        usage = {
            "promptTokens": getattr(final.usage, "input_tokens", 0),
            "completionTokens": getattr(final.usage, "output_tokens", 0),
        }
    yield sse.done("stop", usage)
