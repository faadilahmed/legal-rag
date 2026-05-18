"""Tests for retrieve.py — RRF fusion math + retriever wiring smoke test."""
from unittest.mock import MagicMock

import numpy as np
import pytest

from src.config import RRF_K


def test_rrf_score_higher_for_earlier_rank():
    """An item that appears first in both lists should score higher than one
    appearing last in both."""
    from src.retrieve import _rrf_fuse
    dense_ranked = [(0, 0), (1, 1), (2, 2)]   # idx 0 is rank 0 in dense
    sparse_ranked = [(0, 0), (1, 1), (2, 2)]  # idx 0 is rank 0 in sparse
    fused = _rrf_fuse([dense_ranked, sparse_ranked])
    # idx 0 should outrank idx 2
    sorted_ids = sorted(fused.keys(), key=lambda x: -fused[x])
    assert sorted_ids == [0, 1, 2]
    # Math check: idx 0 gets 2 * 1/(K+1), idx 2 gets 2 * 1/(K+3)
    assert fused[0] == pytest.approx(2.0 / (RRF_K + 1))
    assert fused[2] == pytest.approx(2.0 / (RRF_K + 3))


def test_rrf_blends_disagreeing_lists():
    """An item ranked first in one list and absent from the other beats an item
    ranked second in both, when K is large enough."""
    from src.retrieve import _rrf_fuse
    dense_ranked = [(100, 0)]                   # only dense knows about 100
    sparse_ranked = [(200, 0), (300, 1)]        # sparse has 200 and 300
    fused = _rrf_fuse([dense_ranked, sparse_ranked])
    assert fused[100] == pytest.approx(1.0 / (RRF_K + 1))
    assert fused[200] == pytest.approx(1.0 / (RRF_K + 1))
    assert fused[300] == pytest.approx(1.0 / (RRF_K + 2))


def test_retriever_returns_chunks_with_retrieval_score():
    from src.retrieve import HybridRetriever
    # Mock the index + embedder so we only exercise the retrieval-glue code.
    index = MagicMock()
    index.dense_index.search.return_value = (
        np.array([[0.9, 0.8]]),
        np.array([[0, 1]]),
    )
    index.sparse_index.get_scores.return_value = np.array([0.5, 0.7, 0.2])
    index.chunks = [
        {"chunk_id": "A_1_0", "text": "a"},
        {"chunk_id": "B_1_0", "text": "b"},
        {"chunk_id": "C_1_0", "text": "c"},
    ]
    embedder = MagicMock()
    embedder.embed_query.return_value = np.zeros(8, dtype=np.float32)

    retriever = HybridRetriever(index, embedder)
    results = retriever.retrieve("query", k=3)
    assert len(results) == 3
    for r in results:
        assert "retrieval_score" in r
        assert "chunk_id" in r
    # Scores should be sorted descending.
    scores = [r["retrieval_score"] for r in results]
    assert scores == sorted(scores, reverse=True)


def test_retriever_ticker_filter_restricts_to_set():
    """When ticker_filter is set, only chunks from those tickers appear in results."""
    from unittest.mock import MagicMock
    from src.retrieve import HybridRetriever

    # 6 chunks: 2 AAPL, 2 MSFT, 2 JPM
    chunks = [
        {"chunk_id": "AAPL_1_0", "ticker": "AAPL", "text": "Apple supply chain"},
        {"chunk_id": "AAPL_1_1", "ticker": "AAPL", "text": "Apple revenue"},
        {"chunk_id": "MSFT_1_0", "ticker": "MSFT", "text": "Microsoft Azure"},
        {"chunk_id": "MSFT_1_1", "ticker": "MSFT", "text": "Microsoft AI"},
        {"chunk_id": "JPM_1_0", "ticker": "JPM", "text": "JPMorgan trading"},
        {"chunk_id": "JPM_1_1", "ticker": "JPM", "text": "JPMorgan capital"},
    ]

    index = MagicMock()
    # FAISS would return all 6 in order [0..5]; we oversample so this is fine.
    index.dense_index.search.return_value = (
        np.array([[0.9, 0.85, 0.8, 0.75, 0.7, 0.65]]),
        np.array([[0, 1, 2, 3, 4, 5]]),
    )
    index.sparse_index.get_scores.return_value = np.array([0.5, 0.4, 0.6, 0.3, 0.2, 0.1])
    index.chunks = chunks

    embedder = MagicMock()
    embedder.embed_query.return_value = np.zeros(8, dtype=np.float32)

    retriever = HybridRetriever(index, embedder)
    results = retriever.retrieve("Apple risks", k=4, ticker_filter={"AAPL"})

    # Only AAPL chunks
    assert all(r["ticker"] == "AAPL" for r in results), \
        f"Expected only AAPL, got tickers {[r['ticker'] for r in results]}"
    # There are only 2 AAPL chunks; result count is min(k, available)
    assert len(results) == 2
