"""GET /api/threads/{thread_id}/messages/{message_id}/trace —
returns the per-turn trace dict captured by chat_service. Read-only."""
import json
from typing import Any

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException

from backend.deps import get_db

router = APIRouter(prefix="/api", tags=["trace"])


@router.get("/threads/{thread_id}/messages/{message_id}/trace")
async def get_trace(
    thread_id: str,
    message_id: str,
    db: aiosqlite.Connection = Depends(get_db),
) -> dict[str, Any]:
    """Return the trace JSON for a specific assistant message.

    404 if the message doesn't exist, doesn't belong to the given thread,
    or has no trace (user messages and pre-trace-feature messages don't
    have one).
    """
    async with db.execute(
        "SELECT trace_json FROM messages WHERE id = ? AND thread_id = ?",
        (message_id, thread_id),
    ) as cur:
        row = await cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Message not found")
    trace_json = row[0]
    if not trace_json:
        raise HTTPException(
            status_code=404,
            detail="No trace available for this message",
        )
    try:
        return json.loads(trace_json)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Corrupt trace JSON: {e}",
        ) from e
