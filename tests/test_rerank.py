"""Smoke tests for the reranker — verify it returns top_k items with rerank scores."""
import pytest


@pytest.fixture(scope="module")
def reranker():
    from src.rerank import Reranker
    return Reranker()


def test_reranker_returns_top_k(reranker):
    candidates = [
        {"chunk_id": "1", "text": "Apple discloses concentration risk in component suppliers in Asia."},
        {"chunk_id": "2", "text": "Microsoft's Azure revenue grew 30% year over year."},
        {"chunk_id": "3", "text": "JP Morgan describes regulatory capital requirements."},
        {"chunk_id": "4", "text": "Apple cites geopolitical tension affecting manufacturing partners."},
        {"chunk_id": "5", "text": "Walmart reports growth in groceries and online sales."},
    ]
    top = reranker.rerank("Apple supply chain risks", candidates, top_k=2)
    assert len(top) == 2
    for c in top:
        assert "rerank_score" in c
    # Scores should be sorted descending.
    scores = [c["rerank_score"] for c in top]
    assert scores == sorted(scores, reverse=True)
    # The two Apple-related chunks should rank above the others.
    assert set(c["chunk_id"] for c in top) <= {"1", "4"}


def test_reranker_return_all_includes_rank(reranker):
    """With return_all=True, every candidate is returned with rerank_rank."""
    candidates = [
        {"chunk_id": str(i), "text": f"chunk about apple supply chain risk {i}"}
        for i in range(7)
    ]
    out = reranker.rerank("Apple supply chain risks", candidates, top_k=2, return_all=True)
    assert len(out) == 7, "expected all 7 candidates back, got %d" % len(out)
    for i, c in enumerate(out):
        assert c["rerank_rank"] == i, f"expected rerank_rank={i} at position {i}"
    # Sorted descending by rerank_score
    scores = [c["rerank_score"] for c in out]
    assert scores == sorted(scores, reverse=True)
