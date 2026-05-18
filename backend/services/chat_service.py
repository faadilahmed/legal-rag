"""Chat orchestrator: persist user → load history → retrieve+rerank →
emit sources → stream Claude → persist assistant → auto-title → done."""
import asyncio
import json
import re
import time

import aiosqlite

from backend.routers.threads import db_append_message, db_set_thread_title
from backend.services import sse
from src.config import DENSE_TOP_K, RERANK_TOP_K, SPARSE_TOP_K
from src.generate import CHAT_SYSTEM_PROMPT, CHAT_USER_TEMPLATE, CITATION_PATTERN


FOLLOWUPS_SYSTEM = (
    "You suggest 3 short natural follow-up questions a user might ask next "
    "after reading the assistant's answer about SEC 10-K filings. Each "
    "question should be self-contained (no 'it' / 'that' that depends on "
    "the previous answer) and ≤90 characters. Return ONLY a JSON array of "
    "3 strings, no markdown, no explanation, no preamble. Example: "
    '["What is X?", "How does Y compare?", "Why did Z change?"]'
)


def _generate_followups_sync(generator, query: str, answer: str) -> list[str]:
    """Make ONE small Claude call to produce 3 short follow-up question chips.
    Best-effort: returns [] on any failure so the main answer is unaffected."""
    try:
        resp = generator.client.messages.create(
            model=generator.model,
            max_tokens=200,
            system=FOLLOWUPS_SYSTEM,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Question: {query}\n\nAssistant answer: {answer[:2000]}\n\n"
                        "Return 3 follow-up questions as a JSON array."
                    ),
                }
            ],
        )
        text = resp.content[0].text.strip() if resp.content else ""
        match = re.search(r"\[.*\]", text, re.DOTALL)
        if not match:
            return []
        parsed = json.loads(match.group(0))
        if not isinstance(parsed, list):
            return []
        # Sanitize: drop non-strings, trim, cap at 3, drop empties / overly long.
        out: list[str] = []
        for q in parsed:
            if not isinstance(q, str):
                continue
            q = q.strip()
            if not q or len(q) > 200:
                continue
            out.append(q)
            if len(out) == 3:
                break
        return out
    except Exception:
        return []


# Cached corpus-metadata system prompt addendum. Computed once per pipeline
# instance the first time we see it — the corpus is fixed for a given run.
# Lets Claude answer meta-questions like "how many companies do you cover?"
# from its system context, while still grounding factual claims in chunks.
_CORPUS_META_CACHE: dict[int, str] = {}


def _corpus_meta(pipeline) -> str:
    key = id(pipeline.index)
    cached = _CORPUS_META_CACHE.get(key)
    if cached:
        return cached
    chunks = pipeline.index.chunks
    tickers = sorted({c["ticker"] for c in chunks})
    items = sorted({c["item"] for c in chunks})
    years = sorted({c.get("year") for c in chunks if c.get("year")})
    # Count distinct (ticker, year) pairs to give an accurate filing count
    # for multi-year corpora. Falls back to ticker count if year is missing.
    filings = (
        len({(c["ticker"], c.get("year")) for c in chunks})
        if years
        else len(tickers)
    )
    year_line = (
        f"\n- Filing years covered: {min(years)}–{max(years)} "
        f"({len(years)} distinct years; ~{filings / max(len(tickers), 1):.1f} "
        f"filings per ticker on average)."
        if years
        else ""
    )
    note = (
        "Knowledge-base metadata (use to answer meta-questions about the "
        "corpus itself — what filings you have access to, how many companies, "
        "what sections exist; do NOT use to invent factual content about "
        "specific companies — that still must come from the retrieved chunks):"
        f"\n- {len(chunks):,} chunks across {filings} 10-K (annual report) "
        f"filings from {len(tickers)} companies, sourced from SEC EDGAR."
        f"{year_line}"
        "\n- 10 sectors covered: Tech, Finance, Healthcare, Energy, Consumer, "
        "Industrial, Telecom/Media, Real Estate, Utilities, Materials."
        f"\n- Tickers indexed ({len(tickers)} total): "
        f"{', '.join(tickers)}."
        f"\n- 10-K Items represented across the corpus: {', '.join(items)}."
        "\n- Each user query retrieves the 5 most relevant chunks from this corpus."
        "\n- Chunk IDs encode lineage: format is `TICKER_YEAR_ITEM_N` when year is "
        "known (e.g. `AAPL_2025_1A_35`), or `TICKER_ITEM_N` for single-year corpora."
    )
    _CORPUS_META_CACHE[key] = note
    return note


def _chunk_to_source(c: dict) -> dict:
    """Project only safe-to-wire fields for the SSE sources frame.
    Full text is fetched on demand via /api/chunks/{id}."""
    return {
        "chunk_id": c["chunk_id"],
        "ticker": c["ticker"],
        "year": int(c["year"]) if c.get("year") else None,
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
    year_filter: list[int] | None,
    top_k_rerank: int | None,
    pipeline,
    db: aiosqlite.Connection,
):
    """Async generator yielding SSE-encoded bytes for one chat turn.

    Persists both halves of the turn (user message before streaming starts,
    assistant message after the stream completes). Captures a full per-turn
    trace dict and persists it alongside the assistant message."""
    # 1. Persist user message + grab prior history (excluding the just-inserted user msg)
    # Load history BEFORE inserting so the stream-time "history" is conversation-to-date.
    from backend.routers.threads import _row_to_message  # internal helper

    async with db.execute(
        "SELECT id, role, content, sources_json, created_at, seq, trace_json "
        "FROM messages WHERE thread_id = ? ORDER BY seq ASC",
        (thread_id,),
    ) as cur:
        prior_rows = await cur.fetchall()
    prior = [_row_to_message(r) for r in prior_rows]
    is_first_turn = len(prior) == 0

    await db_append_message(db, thread_id, "user", user_content)

    # 2. Pre-embed query (cheap ~50ms) to capture first 24 dims for the trace viz.
    timings_ms: dict[str, int] = {}

    t_embed_start = time.perf_counter()
    query_emb = pipeline.embedder.embed_query(user_content)  # numpy array, 384-dim
    timings_ms["embed"] = int((time.perf_counter() - t_embed_start) * 1000)

    # 3. Retrieve + rerank (apply ticker/year filter if present)
    # Emit phase status BEFORE each step so the UI can render a live stepper.
    # The frontend special-cases data-part name="status" to REPLACE rather
    # than APPEND so the message only ever holds the most recent phase.
    n_chunks_total = len(pipeline.index.chunks)
    yield sse.data_part(
        "status",
        {"phase": "retrieving", "label": f"Searching {n_chunks_total:,} chunks"},
    )
    ticker_set = set(ticker_filter) if ticker_filter else None
    year_set = set(year_filter) if year_filter else None

    # Count candidates that pass the active filters (for trace metadata).
    if ticker_set or year_set:
        n_candidates_after_filter = sum(
            1
            for c in pipeline.index.chunks
            if (not ticker_set or c["ticker"] in ticker_set)
            and (not year_set or c.get("year") in year_set)
        )
    else:
        n_candidates_after_filter = n_chunks_total

    t_retrieve_start = time.perf_counter()
    candidates = pipeline.retriever.retrieve(
        user_content,
        k=DENSE_TOP_K,
        ticker_filter=ticker_set,
        year_filter=year_set,
        return_breakdown=True,
    )
    timings_ms["retrieve"] = int((time.perf_counter() - t_retrieve_start) * 1000)

    top_k = top_k_rerank or RERANK_TOP_K
    yield sse.data_part(
        "status",
        {"phase": "reranking", "label": f"Reranking {len(candidates)} candidates"},
    )

    t_rerank_start = time.perf_counter()
    # return_all=True → ALL scored candidates with rerank_rank; we slice top_k for generation.
    reranked_all = pipeline.reranker.rerank(
        user_content, candidates, top_k=top_k, return_all=True
    )
    timings_ms["rerank"] = int((time.perf_counter() - t_rerank_start) * 1000)

    # The chunks actually fed to Claude are the top-k slice.
    reranked = reranked_all[:top_k]

    yield sse.data_part(
        "status",
        {"phase": "generating", "label": f"Generating from top {len(reranked)} sources"},
    )

    # 4. Emit sources FIRST (so the UI mounts the panel before text streams in)
    yield sse.data_part(
        "sources", {"chunks": [_chunk_to_source(c) for c in reranked]}
    )

    # Build the resolved system prompt and exact messages array for the trace.
    corpus_meta = _corpus_meta(pipeline)
    resolved_system_prompt = f"{CHAT_SYSTEM_PROMPT}\n\n{corpus_meta}"

    history_msgs = _build_history_messages(prior)
    context_msg = CHAT_USER_TEMPLATE.format(
        context=pipeline.generator._format_context(reranked),
        query=user_content,
    )
    messages_sent = [*history_msgs, {"role": "user", "content": context_msg}]

    # 5. Stream Claude
    accumulated: list[str] = []
    final = None
    t_generate_start = time.perf_counter()
    try:
        with pipeline.generator.stream_chat(
            query=user_content,
            chunks=reranked,
            history=history_msgs,
            extra_system=corpus_meta,
        ) as stream:
            for text in stream.text_stream:
                accumulated.append(text)
                yield sse.text_delta(text)
            final = stream.get_final_message()
    except Exception as e:  # surface any model/network error to the client
        yield sse.error(f"{type(e).__name__}: {e}")
        return
    timings_ms["generate"] = int((time.perf_counter() - t_generate_start) * 1000)

    # Streaming finished — mark phase complete so the UI can collapse the stepper.
    yield sse.data_part("status", {"phase": "done", "label": "Done"})

    # 6. Build the trace dict.
    trace = {
        "query": user_content,
        "query_embedding_preview": [float(x) for x in query_emb[:24].tolist()],
        "filters": {
            "ticker_filter": ticker_filter,
            "year_filter": year_filter,
        },
        "retrieval": {
            "n_chunks_in_index": n_chunks_total,
            "n_candidates_after_filter": n_candidates_after_filter,
            "dense_top_k": DENSE_TOP_K,
            "sparse_top_k": SPARSE_TOP_K,
            "candidates": [
                {
                    "chunk_id": c["chunk_id"],
                    "ticker": c["ticker"],
                    "year": c.get("year"),
                    "item": c["item"],
                    "section_title": c.get("section_title", ""),
                    "dense_score": c.get("dense_score"),
                    "dense_rank": c.get("dense_rank"),
                    "sparse_score": c.get("sparse_score"),
                    "sparse_rank": c.get("sparse_rank"),
                    "rrf_score": c.get("retrieval_score"),
                    "rrf_rank": c.get("rrf_rank"),
                    "rerank_score": c.get("rerank_score"),
                    "rerank_rank": c.get("rerank_rank"),
                    "text_preview": c["text"][:200],
                }
                for c in reranked_all  # ALL candidates with both rrf and rerank info
            ],
        },
        "rerank": {"top_k": top_k},
        "prompt": {
            "system": resolved_system_prompt,
            "messages": messages_sent,
        },
        "timings_ms": timings_ms,
        "usage": {
            "prompt_tokens": getattr(final.usage, "input_tokens", 0) if final else 0,
            "completion_tokens": getattr(final.usage, "output_tokens", 0) if final else 0,
        },
    }

    # 7. Persist assistant message + sources + trace
    full_answer = "".join(accumulated)
    citations = sorted(set(CITATION_PATTERN.findall(full_answer)))
    sources_payload = {
        "chunks": [_chunk_to_source(c) for c in reranked],
        "citations": citations,
    }
    persisted_msg = await db_append_message(
        db,
        thread_id,
        "assistant",
        content=full_answer,
        sources_json=json.dumps(sources_payload),
        trace_json=json.dumps(trace),
    )

    # 8. Emit metadata frame so the frontend Trace button has the DB message id.
    yield sse.data_part("metadata", {"db_message_id": persisted_msg.id})

    # 9. Suggested follow-ups — one extra small Claude call (~200 tokens).
    # Best-effort: silently emits no frame on any failure.
    if full_answer.strip():
        t_followups_start = time.perf_counter()
        followups = await asyncio.to_thread(
            _generate_followups_sync,
            pipeline.generator,
            user_content,
            full_answer,
        )
        timings_ms["followups"] = int((time.perf_counter() - t_followups_start) * 1000)
        if followups:
            yield sse.data_part("followups", {"questions": followups})

    # 10. Auto-title on first turn
    if is_first_turn:
        await db_set_thread_title(db, thread_id, _title_from(user_content))

    # 11. Done
    usage = {}
    if final is not None and getattr(final, "usage", None):
        usage = {
            "promptTokens": getattr(final.usage, "input_tokens", 0),
            "completionTokens": getattr(final.usage, "output_tokens", 0),
        }
    yield sse.done("stop", usage)
