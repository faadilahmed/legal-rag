"""End-to-end streaming test against the real RAGPipeline + a temp DB.

Uses lifespan to load the actual pipeline (slow cold start ~10s) — this is an
integration test, not a unit test. Verifies the wire shape end-to-end.
"""
import importlib
import os

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture(scope="module")
async def chat_client(tmp_path_factory):
    # Use a per-module temp DB so we don't pollute the dev DB.
    tmp = tmp_path_factory.mktemp("chat_stream")
    db_file = tmp / "test_chat.db"
    os.environ["LEGAL_RAG_DB_PATH"] = str(db_file)

    # Reload config + deps so the env var is picked up.
    import backend.config
    importlib.reload(backend.config)
    import backend.deps
    importlib.reload(backend.deps)

    # Re-import main fresh so the lifespan is wired with the reloaded config.
    import backend.main
    importlib.reload(backend.main)
    app = backend.main.app

    transport = ASGITransport(app=app)
    from asgi_lifespan import LifespanManager

    async with LifespanManager(app):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest.mark.asyncio
async def test_stream_emits_sources_then_text_then_done(chat_client):
    # Create a thread
    r = await chat_client.post("/api/threads", json={"title": "stream test"})
    assert r.status_code == 200
    tid = r.json()["id"]

    # Stream a chat turn
    body = {
        "thread_id": tid,
        "message": {"role": "user", "content": "What are Apple's main supply chain risks?"},
    }
    async with chat_client.stream(
        "POST", "/api/chat/stream", json=body, timeout=60.0
    ) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]
        frames: list[str] = []
        async for line in resp.aiter_lines():
            if line:
                frames.append(line)

    # Parse codes
    codes = [f.split(":", 1)[0] for f in frames]
    assert codes.count("2") >= 1, f"missing sources frame; got codes={codes[:20]}"
    assert codes.count("0") >= 3, f"expected ≥3 text deltas; got codes={codes[:20]}"
    assert codes.count("d") == 1, f"expected exactly one done frame; got codes={codes}"
    # First frame should be sources (before any text)
    first_non_empty = [c for c in codes if c in ("0", "2", "3", "d")][0]
    assert first_non_empty == "2", (
        f"expected sources frame first; got codes order: {codes[:10]}"
    )

    # Verify persistence: 2 messages in DB
    r = await chat_client.get(f"/api/threads/{tid}/messages")
    msgs = r.json()["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"
    assert msgs[1]["sources"] is not None
    assert "chunks" in msgs[1]["sources"]

    # Verify auto-title set on first turn
    r = await chat_client.get("/api/threads")
    ts = r.json()["threads"]
    [our_thread] = [t for t in ts if t["id"] == tid]
    assert our_thread["title"].startswith("What are Apple")
