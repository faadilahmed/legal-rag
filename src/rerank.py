"""Stage 7: Rerank top retrieval candidates with a cross-encoder.

Bi-encoders (used in the retriever) embed query and chunk independently — fast
and indexable. Cross-encoders score query-chunk pairs jointly — more accurate,
but only viable on small candidate sets, which is why reranking sits after retrieval.
"""
from sentence_transformers import CrossEncoder

from src.config import RERANK_TOP_K, RERANKER_MODEL


class Reranker:
    def __init__(self, model_name: str = RERANKER_MODEL):
        self.model = CrossEncoder(model_name)

    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int = RERANK_TOP_K,
    ) -> list[dict]:
        """Score (query, chunk_text) pairs and return the top_k by score."""
        pairs = [(query, c["text"]) for c in candidates]
        scores = self.model.predict(pairs, show_progress_bar=False)
        for c, score in zip(candidates, scores):
            c["rerank_score"] = float(score)
        return sorted(candidates, key=lambda x: -x["rerank_score"])[:top_k]
