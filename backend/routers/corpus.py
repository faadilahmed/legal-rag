"""Read-only corpus exploration endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from backend.deps import get_pipeline
from backend.models import (
    ChunkFull,
    ChunkPreview,
    ChunkPreviewList,
    CorpusResponse,
)

router = APIRouter(prefix="/api", tags=["corpus"])


@router.get("/corpus", response_model=CorpusResponse)
def get_corpus(request: Request) -> CorpusResponse:
    """Return the sector → ticker → items tree, prebuilt at startup."""
    tree = request.app.state.corpus_tree
    return CorpusResponse(**tree)


@router.get("/chunks", response_model=ChunkPreviewList)
def list_chunks(
    request: Request,
    ticker: str | None = Query(default=None),
    item: str | None = Query(default=None),
    year: int | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    pipeline=Depends(get_pipeline),
) -> ChunkPreviewList:
    """Filtered chunk list with 300-char previews. ticker+item+year recommended."""
    chunks = pipeline.index.chunks
    filtered = []
    for c in chunks:
        if ticker and c["ticker"] != ticker:
            continue
        if item and c["item"] != item:
            continue
        if year and c.get("year") != year:
            continue
        filtered.append(c)
    total = len(filtered)
    paged = filtered[offset : offset + limit]
    items = [
        ChunkPreview(
            chunk_id=c["chunk_id"],
            ticker=c["ticker"],
            year=c.get("year") or None,
            item=c["item"],
            section_title=c.get("section_title", ""),
            char_count=c.get("char_count", len(c["text"])),
            preview=c["text"][:300],
        )
        for c in paged
    ]
    return ChunkPreviewList(items=items, total=total)


@router.get("/chunks/{chunk_id}", response_model=ChunkFull)
def get_chunk(
    chunk_id: str, request: Request, pipeline=Depends(get_pipeline)
) -> ChunkFull:
    """Return the full chunk text. O(1) via the prebuilt chunk_id index."""
    idx_map = request.app.state.chunk_id_index
    if chunk_id not in idx_map:
        raise HTTPException(status_code=404, detail="chunk not found")
    c = pipeline.index.chunks[idx_map[chunk_id]]
    return ChunkFull(
        chunk_id=c["chunk_id"],
        ticker=c["ticker"],
        year=c.get("year") or None,
        item=c["item"],
        section_title=c.get("section_title", ""),
        text=c["text"],
        char_count=c.get("char_count", len(c["text"])),
    )
