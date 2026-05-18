"""Unit tests for evaluate.py metric functions."""
from unittest.mock import MagicMock

import pytest


def _retriever_returning(per_query_results):
    """Build a fake retriever whose retrieve(query, k) returns the next preset list."""
    iterator = iter(per_query_results)
    retriever = MagicMock()
    retriever.retrieve = MagicMock(side_effect=lambda q, k=5: next(iterator))
    return retriever


def test_recall_at_5_perfect():
    from src.evaluate import evaluate_retrieval
    eval_set = [{"query": "q1", "expected_tickers": ["AAPL"]}]
    retriever = _retriever_returning([
        [{"ticker": "AAPL"}, {"ticker": "MSFT"}],
    ])
    scores = evaluate_retrieval(retriever, eval_set, k=5)
    assert scores["recall@5"] == 1.0
    assert scores["mrr"] == 1.0


def test_recall_at_5_miss():
    from src.evaluate import evaluate_retrieval
    eval_set = [{"query": "q1", "expected_tickers": ["AAPL"]}]
    retriever = _retriever_returning([
        [{"ticker": "MSFT"}, {"ticker": "JPM"}],
    ])
    scores = evaluate_retrieval(retriever, eval_set, k=5)
    assert scores["recall@5"] == 0.0
    assert scores["mrr"] == 0.0


def test_mrr_rank_three():
    from src.evaluate import evaluate_retrieval
    eval_set = [{"query": "q1", "expected_tickers": ["AAPL"]}]
    retriever = _retriever_returning([
        [{"ticker": "MSFT"}, {"ticker": "JPM"}, {"ticker": "AAPL"}, {"ticker": "GS"}],
    ])
    scores = evaluate_retrieval(retriever, eval_set, k=5)
    assert scores["recall@5"] == 1.0
    assert scores["mrr"] == pytest.approx(1 / 3)


def test_recall_averaged_across_queries():
    from src.evaluate import evaluate_retrieval
    eval_set = [
        {"query": "q1", "expected_tickers": ["AAPL"]},
        {"query": "q2", "expected_tickers": ["MSFT"]},
        {"query": "q3", "expected_tickers": ["JPM"]},
    ]
    retriever = _retriever_returning([
        [{"ticker": "AAPL"}],        # hit at rank 1
        [{"ticker": "GS"}],           # miss
        [{"ticker": "JPM"}],          # hit at rank 1
    ])
    scores = evaluate_retrieval(retriever, eval_set, k=5)
    assert scores["recall@5"] == pytest.approx(2 / 3)
    assert scores["mrr"] == pytest.approx((1.0 + 0.0 + 1.0) / 3)
