"""One-time pipeline build: preprocess, chunk, embed, index.

Run after `python -m src.ingest` has populated data/raw/. Output is the FAISS +
BM25 index under data/processed/index/ plus chunks.jsonl for the PySpark module.
"""
import json
import sys
from pathlib import Path

# Allow running as `python scripts/build_index.py` from the project root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.chunk import chunk_document  # noqa: E402
from src.config import CHUNKS_PATH, INDEX_DIR, PROCESSED_DIR, RAW_DIR  # noqa: E402
from src.embed import Embedder  # noqa: E402
from src.index import HybridIndex  # noqa: E402
from src.preprocess import preprocess_filing  # noqa: E402


def find_filings() -> list[Path]:
    """sec-edgar-downloader v5 stores each filing as full-submission.txt."""
    return sorted(RAW_DIR.glob("**/full-submission.txt"))


def main() -> None:
    filing_files = find_filings()
    print(f"Found {len(filing_files)} filings under {RAW_DIR}")
    if not filing_files:
        raise SystemExit("No filings found. Run `python -m src.ingest` first.")

    all_chunks: list[dict] = []
    for filing_path in filing_files:
        try:
            doc = preprocess_filing(filing_path)
            if doc["section_count"] == 0:
                print(f"⚠ {doc['ticker']}: no sections detected, skipping")
                continue
            all_chunks.extend(chunk_document(doc))
        except Exception as e:
            print(f"✗ {filing_path}: {e}")

    print(f"Total chunks: {len(all_chunks)}")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with open(CHUNKS_PATH, "w") as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk) + "\n")
    print(f"Wrote {CHUNKS_PATH}")

    embedder = Embedder()
    embeddings = embedder.embed_chunks([c["text"] for c in all_chunks])
    print(f"Embeddings shape: {embeddings.shape}")

    index = HybridIndex(embeddings, all_chunks)
    index.save(INDEX_DIR)
    print(f"✓ Index saved to {INDEX_DIR}")


if __name__ == "__main__":
    main()
