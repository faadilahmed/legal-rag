"""Smoke tests for HybridIndex — build/save/load + sanity search."""
import numpy as np
import pytest


@pytest.fixture
def tiny_index(tmp_path):
    from src.index import HybridIndex
    chunks = [
        {"chunk_id": "A_1_0", "ticker": "A", "item": "1", "section_title": "B",
         "text": "Apple supply chain risk in Asia.", "char_count": 32},
        {"chunk_id": "B_1_0", "ticker": "B", "item": "1", "section_title": "B",
         "text": "Microsoft Azure cloud growth.", "char_count": 30},
        {"chunk_id": "C_1_0", "ticker": "C", "item": "1", "section_title": "B",
         "text": "JP Morgan regulatory capital.", "char_count": 30},
    ]
    # Random normalized embeddings; we only test the wiring, not retrieval quality.
    rng = np.random.default_rng(0)
    emb = rng.standard_normal((3, 8)).astype(np.float32)
    emb /= np.linalg.norm(emb, axis=1, keepdims=True)
    return HybridIndex(emb, chunks), chunks, tmp_path


def test_dense_search_returns_indices(tiny_index):
    index, chunks, _ = tiny_index
    query = np.random.default_rng(1).standard_normal((1, 8)).astype(np.float32)
    query /= np.linalg.norm(query, axis=1, keepdims=True)
    _, idx = index.dense_index.search(query, 3)
    assert set(idx[0].tolist()) == {0, 1, 2}


def test_sparse_search_finds_keyword_match(tiny_index):
    index, _, _ = tiny_index
    scores = index.sparse_index.get_scores("apple supply chain".lower().split())
    # First chunk mentions Apple supply chain — should rank highest.
    assert int(np.argmax(scores)) == 0


def test_save_and_load_roundtrip(tiny_index):
    from src.index import HybridIndex
    index, chunks, tmp_path = tiny_index
    index.save(tmp_path / "idx")
    loaded = HybridIndex.load(tmp_path / "idx")
    assert len(loaded.chunks) == len(chunks)
    assert loaded.embeddings.shape == index.embeddings.shape
    assert loaded.dense_index.ntotal == 3
