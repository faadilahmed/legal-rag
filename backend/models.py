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
    sources: dict | list | None = None
    created_at: int
    seq: int


class MessageList(BaseModel):
    messages: list[Message]


class DeleteResponse(BaseModel):
    deleted: bool


class ItemSummary(BaseModel):
    item: str
    chunk_count: int


class YearSummary(BaseModel):
    year: int | None  # null for legacy single-year corpora without year metadata
    chunk_count: int
    items: list[ItemSummary]


class TickerSummary(BaseModel):
    ticker: str
    chunk_count: int
    years: list[YearSummary]


class SectorSummary(BaseModel):
    name: str
    ticker_count: int
    chunk_count: int
    tickers: list[TickerSummary]


class CorpusResponse(BaseModel):
    sectors: list[SectorSummary]


class ChunkPreview(BaseModel):
    chunk_id: str
    ticker: str
    year: int | None = None
    item: str
    section_title: str
    char_count: int
    preview: str  # first 300 chars


class ChunkPreviewList(BaseModel):
    items: list[ChunkPreview]
    total: int


class ChunkFull(BaseModel):
    chunk_id: str
    ticker: str
    year: int | None = None
    item: str
    section_title: str
    text: str
    char_count: int
