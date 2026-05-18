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
        year_filter: set[int] | None = None,
        return_breakdown: bool = False,
    ) -> list[dict]:
        """Return top-k chunks ranked by RRF over dense + sparse, with score attached.

        If ticker_filter or year_filter is given (non-empty sets), only chunks
        matching ALL active filters are considered. We post-filter rather than
        rebuild sub-indexes:
        - FAISS over-fetches (max(k*10, 200)) then filters retrieved indices.
        - BM25 zero-masks non-allowed positional scores to -inf before argsort.

        If return_breakdown=True, each returned chunk also carries:
          dense_score, dense_rank, sparse_score, sparse_rank, rrf_rank
        (None for fields where the chunk wasn't in that ranker's top-k).
        Default is False — all existing callers are unaffected.
        """
        active = ticker_filter or year_filter
        if active:
            def _allowed(c: dict) -> bool:
                if ticker_filter and c["ticker"] not in ticker_filter:
                    return False
                if year_filter and c.get("year") not in year_filter:
                    return False
                return True

            allowed_ids = {
                i for i, c in enumerate(self.index.chunks) if _allowed(c)
            }
            dense_search_k = min(len(self.index.chunks), max(k * 10, 200))
        else:
            allowed_ids = None
            dense_search_k = k

        # Dense
        query_emb = self.embedder.embed_query(query).astype(np.float32).reshape(1, -1)
        dense_scores_raw, dense_idx = self.index.dense_index.search(query_emb, dense_search_k)
        dense_hits_full = [int(idx) for idx in dense_idx[0]]
        dense_scores_flat = list(dense_scores_raw[0])
        # Build lookup: chunk_position -> (dense_score, pre-filter rank)
        dense_scores_by_idx: dict[int, float] = {
            chunk_idx: float(score)
            for chunk_idx, score in zip(dense_hits_full, dense_scores_flat)
        }
        dense_hits = dense_hits_full
        if allowed_ids is not None:
            dense_hits = [idx for idx in dense_hits if idx in allowed_ids]
        dense_hits = dense_hits[:k]
        dense_ranked = [(idx, rank) for rank, idx in enumerate(dense_hits)]
        # Post-filter rank lookup: chunk_position -> rank in dense results
        dense_rank_by_idx: dict[int, int] = {
            idx: rank for rank, idx in enumerate(dense_hits)
        }

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
        # Build lookup: chunk_position -> (sparse_score, rank)
        sparse_scores_top: dict[int, float] = {
            idx: float(sparse_scores[idx]) for idx in sparse_top
        }
        sparse_rank_by_idx: dict[int, int] = {
            idx: rank for rank, idx in enumerate(sparse_top)
        }

        fused = _rrf_fuse([dense_ranked, sparse_ranked])
        top_ids = sorted(fused.keys(), key=lambda x: -fused[x])[:k]

        results = []
        for rrf_rank, idx in enumerate(top_ids):
            chunk = {**self.index.chunks[idx], "retrieval_score": fused[idx]}
            if return_breakdown:
                chunk["dense_score"] = dense_scores_by_idx.get(idx)
                chunk["dense_rank"] = dense_rank_by_idx.get(idx)
                chunk["sparse_score"] = sparse_scores_top.get(idx)
                chunk["sparse_rank"] = sparse_rank_by_idx.get(idx)
                chunk["rrf_rank"] = rrf_rank
            results.append(chunk)
        return results
