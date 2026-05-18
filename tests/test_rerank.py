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
