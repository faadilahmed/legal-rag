"""Run the evaluation suite — retrieval metrics + RAGAS LLM-judged metrics."""
import json
import sys
from pathlib import Path

# Allow running as `python scripts/run_eval.py` from the project root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import EVAL_DIR  # noqa: E402
from src.evaluate import evaluate_generation_ragas, evaluate_retrieval, load_eval_set  # noqa: E402
from src.pipeline import RAGPipeline  # noqa: E402


def main() -> None:
    pipeline = RAGPipeline.load()
    eval_set = load_eval_set()
    print(f"Loaded {len(eval_set)} eval queries")

    print("\n[1/2] Retrieval evaluation (Recall@5, MRR)...")
    retrieval_scores = evaluate_retrieval(pipeline.retriever, eval_set, k=5)
    print(retrieval_scores)

    print("\n[2/2] RAGAS evaluation (faithfulness, answer_relevancy, context_precision)...")
    try:
        ragas_scores = evaluate_generation_ragas(pipeline, eval_set)
        print(ragas_scores)
    except Exception as e:
        print(f"RAGAS failed: {e}")
        ragas_scores = {"error": str(e)}

    results = {"retrieval": retrieval_scores, "ragas": ragas_scores}
    out_path = EVAL_DIR / "eval_results.json"
    with open(out_path, "w") as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\n✓ Results written to {out_path}")


if __name__ == "__main__":
    main()
