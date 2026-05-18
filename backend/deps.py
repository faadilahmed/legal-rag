"""FastAPI dependencies. Pipeline is loaded once at startup and reused.
DB connections are opened per-request via aiosqlite."""
from typing import AsyncIterator

import aiosqlite
from fastapi import Request

from backend.config import DB_PATH


def get_pipeline(request: Request):
    """Return the singleton RAGPipeline stashed on app.state by the lifespan."""
    return request.app.state.pipeline


async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    """Open a fresh aiosqlite connection per request. Foreign keys ON."""
    async with aiosqlite.connect(DB_PATH) as conn:
        await conn.execute("PRAGMA foreign_keys = ON")
        yield conn
