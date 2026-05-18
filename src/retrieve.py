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

    def retrieve(
        self,
        query: str,
        k: int = DENSE_TOP_K,
        ticker_filter: set[str] | None = None,
    ) -> list[dict]:
        """Return top-k chunks ranked by RRF over dense + sparse, with score attached.

        If ticker_filter is given (a non-empty set of ticker strings), only chunks
        whose ticker is in the set are considered. We post-filter rather than
        rebuild sub-indexes:
        - FAISS over-fetches (max(k*10, 200)) then filters retrieved indices.
        - BM25 zero-masks non-allowed positional scores to -inf before argsort.
        """
        if ticker_filter:
            allowed_ids = {
                i for i, c in enumerate(self.index.chunks) if c["ticker"] in ticker_filter
            }
            dense_search_k = min(len(self.index.chunks), max(k * 10, 200))
        else:
            allowed_ids = None
            dense_search_k = k

        # Dense
        query_emb = self.embedder.embed_query(query).astype(np.float32).reshape(1, -1)
        _, dense_idx = self.index.dense_index.search(query_emb, dense_search_k)
        dense_hits = [int(idx) for idx in dense_idx[0]]
        if allowed_ids is not None:
            dense_hits = [idx for idx in dense_hits if idx in allowed_ids]
        dense_hits = dense_hits[:k]
        dense_ranked = [(idx, rank) for rank, idx in enumerate(dense_hits)]

        # Sparse
        tokenized_query = query.lower().split()
        sparse_scores = self.index.sparse_index.get_scores(tokenized_query)
        if allowed_ids is not None:
            mask = np.ones_like(sparse_scores, dtype=bool)
            for i in allowed_ids:
                mask[i] = False
            sparse_scores = sparse_scores.copy()
            sparse_scores[mask] = -np.inf
        sparse_top = np.argsort(sparse_scores)[::-1][:SPARSE_TOP_K]
        sparse_top = [int(idx) for idx in sparse_top if sparse_scores[idx] > -np.inf]
        sparse_ranked = [(idx, rank) for rank, idx in enumerate(sparse_top)]

        fused = _rrf_fuse([dense_ranked, sparse_ranked])
        top_ids = sorted(fused.keys(), key=lambda x: -fused[x])[:k]
        return [
            {**self.index.chunks[idx], "retrieval_score": fused[idx]}
            for idx in top_ids
        ]
