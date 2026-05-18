"""POST /api/chat/stream — Server-Sent Events streaming chat."""
import aiosqlite
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from backend.deps import get_db, get_pipeline
from backend.services.chat_service import stream_chat

router = APIRouter(prefix="/api", tags=["chat"])


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    thread_id: str
    message: ChatMessageIn
    ticker_filter: list[str] | None = None
    top_k_rerank: int | None = None


@router.post("/chat/stream")
async def chat_stream(
    req: ChatRequest,
    pipeline=Depends(get_pipeline),
    db: aiosqlite.Connection = Depends(get_db),
):
    if req.message.role != "user":
        raise HTTPException(status_code=400, detail="message.role must be 'user'")
    # Confirm thread exists; surfaces a friendly 404 instead of an opaque stream error
    async with db.execute(
        "SELECT 1 FROM threads WHERE id = ?", (req.thread_id,)
    ) as cur:
        if await cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="Thread not found")

    return StreamingResponse(
        stream_chat(
            req.thread_id,
            req.message.content,
            req.ticker_filter,
            req.top_k_rerank,
            pipeline,
            db,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
