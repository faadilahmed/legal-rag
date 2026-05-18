"""Smoke tests for the embedder wrapper — verify shape, normalization, determinism."""
import numpy as np
import pytest

from src.config import EMBEDDING_DIM


@pytest.fixture(scope="module")
def embedder():
    from src.embed import Embedder
    return Embedder()


def test_embed_chunks_returns_correct_shape(embedder):
    texts = ["Apple discloses supply chain risk.", "Microsoft cites AI as a growth opportunity."]
    out = embedder.embed_chunks(texts)
    assert out.shape == (2, EMBEDDING_DIM)
    assert out.dtype == np.float32 or out.dtype == np.float64


def test_embeddings_are_normalized(embedder):
    texts = ["The quick brown fox jumps over the lazy dog."]
    out = embedder.embed_chunks(texts)
    norms = np.linalg.norm(out, axis=1)
    np.testing.assert_allclose(norms, 1.0, atol=1e-4)


def test_embed_query_returns_1d_vector(embedder):
    q = embedder.embed_query("What are supply chain risks?")
    assert q.shape == (EMBEDDING_DIM,)


def test_embeddings_are_deterministic(embedder):
    a = embedder.embed_chunks(["test sentence"])
    b = embedder.embed_chunks(["test sentence"])
    np.testing.assert_allclose(a, b, atol=1e-6)
