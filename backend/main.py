"""FastAPI app factory + lifespan + health endpoint.

Lifespan loads the RAGPipeline once (takes ~5-10s cold) and initializes the
SQLite schema. The pipeline is stashed on app.state.pipeline and accessed via
the get_pipeline dependency.
"""
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Make the existing src/ package importable when uvicorn runs from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.config import CORS_ORIGINS, DB_PATH  # noqa: E402
from backend.db import init_schema  # noqa: E402
from backend.deps import get_pipeline  # noqa: E402
from backend.models import HealthResponse  # noqa: E402
from backend.routers import threads as threads_router  # noqa: E402
from src.pipeline import RAGPipeline  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_schema(DB_PATH)
    print(f"[startup] SQLite schema ready at {DB_PATH}")
    print("[startup] loading RAGPipeline (FAISS + BM25 + models)...")
    app.state.pipeline = RAGPipeline.load()
    n_chunks = len(app.state.pipeline.index.chunks)
    n_tickers = len({c["ticker"] for c in app.state.pipeline.index.chunks})
    print(f"[startup] pipeline ready: {n_chunks} chunks across {n_tickers} tickers")
    yield
    # No teardown needed; FAISS + numpy will be freed on process exit.


app = FastAPI(title="SEC 10-K Q&A", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(threads_router.router)


@app.get("/api/health", response_model=HealthResponse)
def health(pipeline=Depends(get_pipeline)) -> HealthResponse:
    chunks = pipeline.index.chunks
    return HealthResponse(
        status="ok",
        chunks_loaded=len(chunks),
        tickers=len({c["ticker"] for c in chunks}),
    )
