"""Stage 5: Build the hybrid (dense FAISS + sparse BM25) index and persist it."""
import pickle
from pathlib import Path

import faiss
import numpy as np
from rank_bm25 import BM25Okapi


class HybridIndex:
    """Co-located dense and sparse indexes with their backing chunk metadata."""

    def __init__(self, embeddings: np.ndarray, chunks: list[dict]):
        self.embeddings = embeddings
        self.chunks = chunks

        # Dense: inner product on normalized vectors == cosine similarity.
        self.dense_index = faiss.IndexFlatIP(embeddings.shape[1])
        self.dense_index.add(embeddings.astype(np.float32))

        # Sparse: simple whitespace tokenization. BM25 catches exact-term matches
        # (tickers, named entities) that embeddings tend to blur.
        tokenized = [chunk["text"].lower().split() for chunk in chunks]
        self.sparse_index = BM25Okapi(tokenized)

    def save(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)
        faiss.write_index(self.dense_index, str(path / "faiss.index"))
        with open(path / "bm25.pkl", "wb") as f:
            pickle.dump(self.sparse_index, f)
        with open(path / "chunks.pkl", "wb") as f:
            pickle.dump(self.chunks, f)
        np.save(path / "embeddings.npy", self.embeddings)

    @classmethod
    def load(cls, path: Path) -> "HybridIndex":
        embeddings = np.load(path / "embeddings.npy")
        with open(path / "chunks.pkl", "rb") as f:
            chunks = pickle.load(f)
        instance = cls.__new__(cls)
        instance.embeddings = embeddings
        instance.chunks = chunks
        instance.dense_index = faiss.read_index(str(path / "faiss.index"))
        with open(path / "bm25.pkl", "rb") as f:
            instance.sparse_index = pickle.load(f)
        return instance
