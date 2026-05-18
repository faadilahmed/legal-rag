"""Stage 6: Hybrid retrieval — dense (FAISS) + sparse (BM25) fused with RRF.

Reciprocal Rank Fusion is parameter-free and works across incomparable score
scales: each item's contribution from each ranker is 1 / (K + rank + 1), summed
across rankers. K=60 is the canonical default from the original RRF paper.
"""
from collections import defaultdict

import numpy as np

from src.config import DENSE_TOP_K, RRF_K, SPARSE_TOP_K


def _rrf_fuse(ranked_lists: list[list[tuple[int, int]]]) -> dict[int, float]:
    """Each list is [(item_id, rank)]; ranks are 0-indexed. Returns {item_id: fused_score}."""
    fused: dict[int, float] = defaultdict(float)
    for ranked in ranked_lists:
        for item_id, rank in ranked:
            fused[item_id] += 1.0 / (RRF_K + rank + 1)
    return fused


class HybridRetriever:
    def __init__(self, index, embedder):
        self.index = index
        self.embedder = embedder

    def retrieve(self, query: str, k: int = DENSE_TOP_K) -> list[dict]:
        """Return top-k chunks ranked by RRF over dense + sparse, with score attached."""
        # Dense
        query_emb = self.embedder.embed_query(query).astype(np.float32).reshape(1, -1)
        _, dense_idx = self.index.dense_index.search(query_emb, k)
        dense_ranked = [(int(idx), rank) for rank, idx in enumerate(dense_idx[0])]

        # Sparse
        tokenized_query = query.lower().split()
        sparse_scores = self.index.sparse_index.get_scores(tokenized_query)
        sparse_top = np.argsort(sparse_scores)[::-1][:SPARSE_TOP_K]
        sparse_ranked = [(int(idx), rank) for rank, idx in enumerate(sparse_top)]

        fused = _rrf_fuse([dense_ranked, sparse_ranked])
        top_ids = sorted(fused.keys(), key=lambda x: -fused[x])[:k]
        return [
            {**self.index.chunks[idx], "retrieval_score": fused[idx]}
            for idx in top_ids
        ]
