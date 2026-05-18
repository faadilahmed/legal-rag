"""Threads + messages CRUD round-trip against a temp SQLite DB."""
import os
import tempfile
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture
async def client(tmp_path, monkeypatch):
    # Point the backend at a temp DB BEFORE importing the app.
    db_file = tmp_path / "test_chat.db"
    monkeypatch.setenv("LEGAL_RAG_DB_PATH", str(db_file))

    # Force-reload backend.config so the env var takes effect.
    import importlib

    import backend.config

    importlib.reload(backend.config)
    import backend.db
    import backend.deps

    importlib.reload(backend.deps)

    # Init schema directly (don't run the full lifespan — we don't need the RAGPipeline).
    backend.db.init_schema(backend.config.DB_PATH)

    # Build a minimal app that mounts only the threads router (skip lifespan to avoid
    # loading FAISS/embedder for a CRUD test).
    from fastapi import FastAPI

    from backend.routers import threads as threads_router

    test_app = FastAPI()
    test_app.include_router(threads_router.router)

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_create_list_and_get_messages(client):
    # Initially no threads
    r = await client.get("/api/threads")
    assert r.status_code == 200
    assert r.json() == {"threads": []}

    # Create a thread
    r = await client.post("/api/threads", json={"title": "Apple risks"})
    assert r.status_code == 200
    t = r.json()
    assert t["title"] == "Apple risks"
    assert t["archived"] is False
    tid = t["id"]

    # List shows it
    r = await client.get("/api/threads")
    assert r.status_code == 200
    listed = r.json()["threads"]
    assert len(listed) == 1
    assert listed[0]["id"] == tid

    # Empty messages
    r = await client.get(f"/api/threads/{tid}/messages")
    assert r.status_code == 200
    assert r.json() == {"messages": []}


@pytest.mark.asyncio
async def test_patch_rename_and_archive(client):
    r = await client.post("/api/threads", json={"title": "Original"})
    tid = r.json()["id"]

    r = await client.patch(f"/api/threads/{tid}", json={"title": "Renamed"})
    assert r.status_code == 200
    assert r.json()["title"] == "Renamed"

    r = await client.patch(f"/api/threads/{tid}", json={"archived": True})
    assert r.status_code == 200
    assert r.json()["archived"] is True

    # Archived threads are excluded from the default list
    r = await client.get("/api/threads")
    assert r.json()["threads"] == []


@pytest.mark.asyncio
async def test_delete_cascades(client):
    """Hard delete of a thread cascades to its messages."""
    import sqlite3

    import backend.config

    r = await client.post("/api/threads", json={})
    tid = r.json()["id"]

    # Insert a message directly via the internal helper to exercise cascade
    from backend.routers.threads import db_append_message
    import aiosqlite

    async with aiosqlite.connect(backend.config.DB_PATH) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        await db_append_message(conn, tid, "user", "hi")
        await db_append_message(conn, tid, "assistant", "hello", sources_json='[]')

    r = await client.get(f"/api/threads/{tid}/messages")
    assert len(r.json()["messages"]) == 2

    r = await client.delete(f"/api/threads/{tid}")
    assert r.status_code == 200
    assert r.json() == {"deleted": True}

    # Cascade: messages must be gone
    conn = sqlite3.connect(backend.config.DB_PATH)
    try:
        # Re-enable FKs for the verifier connection too
        conn.execute("PRAGMA foreign_keys = ON")
        (count,) = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE thread_id = ?", (tid,)
        ).fetchone()
    finally:
        conn.close()
    assert count == 0

    # And the thread itself is gone
    r = await client.get("/api/threads")
    assert r.json()["threads"] == []


@pytest.mark.asyncio
async def test_patch_not_found(client):
    r = await client.patch("/api/threads/does-not-exist", json={"title": "x"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_messages_ordered_by_seq(client):
    """seq should increment per-thread; messages return in seq order."""
    import aiosqlite

    import backend.config
    from backend.routers.threads import db_append_message

    r = await client.post("/api/threads", json={})
    tid = r.json()["id"]

    async with aiosqlite.connect(backend.config.DB_PATH) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        await db_append_message(conn, tid, "user", "msg 1")
        await db_append_message(conn, tid, "assistant", "msg 2", sources_json='[]')
        await db_append_message(conn, tid, "user", "msg 3")

    r = await client.get(f"/api/threads/{tid}/messages")
    msgs = r.json()["messages"]
    assert [m["seq"] for m in msgs] == [0, 1, 2]
    assert [m["content"] for m in msgs] == ["msg 1", "msg 2", "msg 3"]
    assert msgs[1]["sources"] == []  # assistant message has parsed sources
    assert msgs[0]["sources"] is None  # user message has none
