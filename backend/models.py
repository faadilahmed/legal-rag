"""Pydantic v2 request/response models. Kept small — only what A1 needs.
Additional models are added in later phases."""
from typing import Any, Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    chunks_loaded: int
    tickers: int


class Thread(BaseModel):
    id: str
    title: str
    created_at: int
    updated_at: int
    archived: bool


class ThreadList(BaseModel):
    threads: list[Thread]


class ThreadCreate(BaseModel):
    title: str | None = None


class ThreadPatch(BaseModel):
    title: str | None = None
    archived: bool | None = None


class Message(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    sources: list[Any] | None = None
    created_at: int
    seq: int


class MessageList(BaseModel):
    messages: list[Message]


class DeleteResponse(BaseModel):
    deleted: bool
