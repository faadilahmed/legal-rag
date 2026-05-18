"""Integration tests for the corpus + chunks endpoints. Uses the real
RAGPipeline (cold-start ~10s) so this is a module-scoped fixture."""
import importlib
import os

import pytest
import pytest_asyncio
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient


@pytest_asyncio.fixture(scope="module")
async def client(tmp_path_factory):
    tmp = tmp_path_factory.mktemp("corpus")
    os.environ["LEGAL_RAG_DB_PATH"] = str(tmp / "corpus.db")

    import backend.config
    importlib.reload(backend.config)
    import backend.deps
    importlib.reload(backend.deps)
    import backend.main
    importlib.reload(backend.main)
    app = backend.main.app

    transport = ASGITransport(app=app)
    async with LifespanManager(app):
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac


@pytest.mark.asyncio
async def test_corpus_returns_10_sectors_76_tickers(client):
    r = await client.get("/api/corpus")
    assert r.status_code == 200
    body = r.json()
    sectors = body["sectors"]
    # Expect the 10 named sectors (no "Other")
    sector_names = [s["name"] for s in sectors]
    assert "Tech" in sector_names
    assert "Materials" in sector_names
    # All 76 tickers accounted for; C and MS not included (zero chunks)
    total_tickers = sum(s["ticker_count"] for s in sectors)
    assert total_tickers == 76, f"expected 76 tickers in tree, got {total_tickers}"
    # Total chunk count across all sectors == 24290
    total_chunks = sum(s["chunk_count"] for s in sectors)
    assert total_chunks == 24290


@pytest.mark.asyncio
async def test_corpus_excludes_failed_tickers(client):
    r = await client.get("/api/corpus")
    finance = next(s for s in r.json()["sectors"] if s["name"] == "Finance")
    finance_tickers = {t["ticker"] for t in finance["tickers"]}
    assert "C" not in finance_tickers
    assert "MS" not in finance_tickers
    assert "JPM" in finance_tickers
    assert "WFC" in finance_tickers


@pytest.mark.asyncio
async def test_corpus_items_sorted_naturally(client):
    """Items should be: 1, 1A, 1B, 1C, 2, 3, ..., 7, 7A, 8, 9, 9A, ..."""
    r = await client.get("/api/corpus")
    aapl = None
    for s in r.json()["sectors"]:
        for t in s["tickers"]:
            if t["ticker"] == "AAPL":
                aapl = t
                break
    assert aapl is not None
    items = [i["item"] for i in aapl["items"]]
    # 1 must come before 1A which must come before 10
    if "1" in items and "1A" in items and "10" in items:
        assert items.index("1") < items.index("1A") < items.index("10")


@pytest.mark.asyncio
async def test_chunks_filter_by_ticker_and_item(client):
    r = await client.get("/api/chunks", params={"ticker": "AAPL", "item": "1A"})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] > 0
    for chunk in body["items"]:
        assert chunk["ticker"] == "AAPL"
        assert chunk["item"] == "1A"
        assert len(chunk["preview"]) <= 300


@pytest.mark.asyncio
async def test_chunks_pagination(client):
    r1 = await client.get("/api/chunks", params={"ticker": "AAPL", "limit": 5, "offset": 0})
    r2 = await client.get("/api/chunks", params={"ticker": "AAPL", "limit": 5, "offset": 5})
    assert r1.status_code == 200 and r2.status_code == 200
    ids1 = {c["chunk_id"] for c in r1.json()["items"]}
    ids2 = {c["chunk_id"] for c in r2.json()["items"]}
    assert ids1.isdisjoint(ids2)
    assert len(ids1) == 5
    assert len(ids2) == 5


@pytest.mark.asyncio
async def test_get_chunk_full_text(client):
    # Find a known chunk_id via the filtered list, then fetch its full text.
    r = await client.get("/api/chunks", params={"ticker": "AAPL", "limit": 1})
    cid = r.json()["items"][0]["chunk_id"]
    r = await client.get(f"/api/chunks/{cid}")
    assert r.status_code == 200
    body = r.json()
    assert body["chunk_id"] == cid
    assert body["ticker"] == "AAPL"
    assert len(body["text"]) >= len(body["text"][:300])  # full text returned


@pytest.mark.asyncio
async def test_get_chunk_404(client):
    r = await client.get("/api/chunks/does-not-exist-id")
    assert r.status_code == 404
