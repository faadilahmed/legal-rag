"""Stage 4 (single-machine): Wrap sentence-transformers for batched chunk + query embedding.

Returns L2-normalized vectors so cosine similarity == inner product, letting
the FAISS IndexFlatIP cover both metrics with one index.
"""
import numpy as np
from sentence_transformers import SentenceTransformer

from src.config import EMBEDDING_MODEL


class Embedder:
    def __init__(self, model_name: str = EMBEDDING_MODEL):
        self.model = SentenceTransformer(model_name)
        self.dim = self.model.get_embedding_dimension()

    def embed_chunks(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        """Embed a list of texts; returns (n, dim) normalized array."""
        return self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=True,
            normalize_embeddings=True,
            convert_to_numpy=True,
        )

    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query string; returns (dim,) normalized vector."""
        return self.model.encode(query, normalize_embeddings=True)
