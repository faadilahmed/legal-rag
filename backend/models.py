"""Pydantic v2 request/response models. Kept small — only what A1 needs.
Additional models are added in later phases."""
from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    chunks_loaded: int
    tickers: int
