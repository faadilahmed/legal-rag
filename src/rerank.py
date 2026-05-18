"""Stage 7: Rerank top retrieval candidates with a cross-encoder.

Bi-encoders (used in the retriever) embed query and chunk independently — fast
and indexable. Cross-encoders score query-chunk pairs jointly — more accurate,
but only viable on small candidate sets, which is why reranking sits after retrieval.
"""
from sentence_transformers import CrossEncoder

from src.config import RERANK_TOP_K, RERANKER_MODEL


def _scoreable_text(chunk: dict) -> str:
    """Prepend chunk metadata so the cross-encoder sees ticker context.

    10-K body chunks often refer to the issuer as "the Company" rather than by
    name. For a query like "Apple's discussion of China-related risks", chunks
    that already contain "Apple Inc." (typically because the chunker captured
    the page-header line) rerank dramatically higher than chunks that say
    "the Company" — even when those latter chunks are the substantive answer.
    Prepending a one-line metadata header levels the playing field: every
    chunk now carries identifying context for the cross-encoder.
    """
    header = f"{chunk['ticker']} {chunk.get('year', '')} 10-K Item {chunk['item']}"
    return f"{header}: {chunk['text']}"


class Reranker:
    def __init__(self, model_name: str = RERANKER_MODEL):
        self.model = CrossEncoder(model_name)

    def rerank(
        self,
        query: str,
        candidates: list[dict],
        top_k: int = RERANK_TOP_K,
        return_all: bool = False,
    ) -> list[dict]:
        """Score (query, chunk_text) pairs and return the top_k by score.

        If return_all=True, returns ALL scored candidates sorted by rerank_score
        descending, each carrying a rerank_rank field (0 = highest score).
        Default is False — all existing callers still receive only top_k chunks
        with no rerank_rank field.
        """
        pairs = [(query, _scoreable_text(c)) for c in candidates]
        scores = self.model.predict(pairs, show_progress_bar=False)
        for c, score in zip(candidates, scores):
            c["rerank_score"] = float(score)
        sorted_candidates = sorted(candidates, key=lambda x: -x["rerank_score"])
        if return_all:
            for rank, c in enumerate(sorted_candidates):
                c["rerank_rank"] = rank
            return sorted_candidates
        return sorted_candidates[:top_k]
