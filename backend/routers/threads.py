"""Threads + messages CRUD."""
import json
import time
import uuid

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from backend.deps import get_db
from backend.models import (
    DeleteResponse,
    Message,
    MessageList,
    Thread,
    ThreadCreate,
    ThreadList,
    ThreadPatch,
)

router = APIRouter(prefix="/api", tags=["threads"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _row_to_thread(row) -> Thread:
    return Thread(
        id=row[0],
        title=row[1],
        created_at=row[2],
        updated_at=row[3],
        archived=bool(row[4]),
    )


def _row_to_message(row) -> Message:
    return Message(
        id=row[0],
        role=row[1],
        content=row[2],
        sources=json.loads(row[3]) if row[3] else None,
        created_at=row[4],
        seq=row[5],
    )


@router.get("/threads", response_model=ThreadList)
async def list_threads(db: aiosqlite.Connection = Depends(get_db)) -> ThreadList:
    async with db.execute(
        "SELECT id, title, created_at, updated_at, archived "
        "FROM threads WHERE archived = 0 ORDER BY updated_at DESC"
    ) as cur:
        rows = await cur.fetchall()
    return ThreadList(threads=[_row_to_thread(r) for r in rows])


@router.post("/threads", response_model=Thread)
async def create_thread(
    body: ThreadCreate, db: aiosqlite.Connection = Depends(get_db)
) -> Thread:
    now = _now_ms()
    thread_id = str(uuid.uuid4())
    title = body.title or "New chat"
    await db.execute(
        "INSERT INTO threads (id, title, created_at, updated_at, archived) "
        "VALUES (?, ?, ?, ?, 0)",
        (thread_id, title, now, now),
    )
    await db.commit()
    return Thread(
        id=thread_id, title=title, created_at=now, updated_at=now, archived=False
    )


@router.patch("/threads/{thread_id}", response_model=Thread)
async def patch_thread(
    thread_id: str, body: ThreadPatch, db: aiosqlite.Connection = Depends(get_db)
) -> Thread:
    # Fetch first to confirm existence
    async with db.execute(
        "SELECT id, title, created_at, updated_at, archived FROM threads WHERE id = ?",
        (thread_id,),
    ) as cur:
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    updates: list[str] = []
    params: list = []
    if body.title is not None:
        updates.append("title = ?")
        params.append(body.title)
    if body.archived is not None:
        updates.append("archived = ?")
        params.append(1 if body.archived else 0)
    if not updates:
        return _row_to_thread(row)

    updates.append("updated_at = ?")
    params.append(_now_ms())
    params.append(thread_id)
    await db.execute(
        f"UPDATE threads SET {', '.join(updates)} WHERE id = ?", params
    )
    await db.commit()

    async with db.execute(
        "SELECT id, title, created_at, updated_at, archived FROM threads WHERE id = ?",
        (thread_id,),
    ) as cur:
        row = await cur.fetchone()
    return _row_to_thread(row)


@router.delete("/threads/{thread_id}", response_model=DeleteResponse)
async def delete_thread(
    thread_id: str, db: aiosqlite.Connection = Depends(get_db)
) -> DeleteResponse:
    async with db.execute(
        "SELECT 1 FROM threads WHERE id = ?", (thread_id,)
    ) as cur:
        if await cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Thread not found")
    await db.execute("DELETE FROM threads WHERE id = ?", (thread_id,))
    await db.commit()
    return DeleteResponse(deleted=True)


@router.get("/threads/{thread_id}/messages", response_model=MessageList)
async def get_messages(
    thread_id: str, db: aiosqlite.Connection = Depends(get_db)
) -> MessageList:
    async with db.execute(
        "SELECT 1 FROM threads WHERE id = ?", (thread_id,)
    ) as cur:
        if await cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Thread not found")
    async with db.execute(
        "SELECT id, role, content, sources_json, created_at, seq "
        "FROM messages WHERE thread_id = ? ORDER BY seq ASC",
        (thread_id,),
    ) as cur:
        rows = await cur.fetchall()
    return MessageList(messages=[_row_to_message(r) for r in rows])


async def db_append_message(
    db: aiosqlite.Connection,
    thread_id: str,
    role: str,
    content: str,
    sources_json: str | None = None,
) -> Message:
    """Internal helper used by the chat service. Inserts a message and bumps
    the thread's updated_at. Returns the persisted Message."""
    now = _now_ms()
    msg_id = str(uuid.uuid4())

    async with db.execute(
        "SELECT COALESCE(MAX(seq), -1) + 1 FROM messages WHERE thread_id = ?",
        (thread_id,),
    ) as cur:
        (next_seq,) = await cur.fetchone()

    await db.execute(
        "INSERT INTO messages (id, thread_id, role, content, sources_json, created_at, seq) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (msg_id, thread_id, role, content, sources_json, now, next_seq),
    )
    await db.execute(
        "UPDATE threads SET updated_at = ? WHERE id = ?", (now, thread_id)
    )
    await db.commit()
    return Message(
        id=msg_id,
        role=role,  # type: ignore[arg-type]
        content=content,
        sources=json.loads(sources_json) if sources_json else None,
        created_at=now,
        seq=next_seq,
    )


async def db_set_thread_title(
    db: aiosqlite.Connection, thread_id: str, title: str
) -> None:
    """Internal helper used by chat service to auto-title a thread on its first turn."""
    await db.execute(
        "UPDATE threads SET title = ?, updated_at = ? WHERE id = ?",
        (title, _now_ms(), thread_id),
    )
    await db.commit()
