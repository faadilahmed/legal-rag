"""Stage 9: Evaluation — retrieval metrics (Recall@k, MRR) + RAGAS LLM-judged metrics."""
import json
from pathlib import Path

import numpy as np

from src.config import EVAL_DIR


def load_eval_set(path: Path | None = None) -> list[dict]:
    """Load the hand-labeled eval queries from JSON."""
    path = path or (EVAL_DIR / "eval_queries.json")
    with open(path) as f:
        return json.load(f)


def evaluate_retrieval(retriever, eval_set: list[dict], k: int = 5) -> dict[str, float]:
    """Compute Recall@k and MRR over an eval set.

    Each eval row supplies `expected_tickers` (the set of tickers whose 10-K
    should be relevant). A query "hits" if any retrieved chunk's ticker is in
    that set. MRR uses the rank of the first hit.
    """
    recall_hits = 0
    reciprocal_ranks: list[float] = []

    for example in eval_set:
        results = retriever.retrieve(example["query"], k=k)
        retrieved_tickers = [r["ticker"] for r in results]
        expected = set(example["expected_tickers"])

        if any(t in expected for t in retrieved_tickers):
            recall_hits += 1

        rr = 0.0
        for rank, ticker in enumerate(retrieved_tickers, start=1):
            if ticker in expected:
                rr = 1 / rank
                break
        reciprocal_ranks.append(rr)

    n = max(len(eval_set), 1)
    return {
        f"recall@{k}": recall_hits / n,
        "mrr": float(np.mean(reciprocal_ranks)) if reciprocal_ranks else 0.0,
    }


def evaluate_generation_ragas(pipeline, eval_set: list[dict]) -> dict:
    """Run RAGAS faithfulness + answer_relevancy + context_precision on the eval set.

    Note: RAGAS internally calls an LLM as judge — by default OpenAI.
    Set OPENAI_API_KEY in .env, or pass a custom LLM into ragas.evaluate(llm=...).
    """
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import answer_relevancy, context_precision, faithfulness

    rows = []
    for example in eval_set:
        result = pipeline.answer(example["query"])
        rows.append({
            "question": example["query"],
            "answer": result["answer"],
            "contexts": [c["text"] for c in result["chunks"]],
            "ground_truth": example.get("gold_answer", ""),
        })

    ds = Dataset.from_list(rows)
    scores = evaluate(ds, metrics=[faithfulness, answer_relevancy, context_precision])
    return dict(scores)
