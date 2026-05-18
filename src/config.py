"""Project-wide constants: paths, model names, retrieval params, ticker list, SEC user-agent."""
import os
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
EVAL_DIR = DATA_DIR / "eval"
# INDEX_DIR can be overridden via env so a deployed container can cache the
# downloaded FAISS/BM25 files in a writable mount (e.g. /app/index_cache)
# instead of the source-tree default.
INDEX_DIR = Path(os.environ.get("LEGAL_RAG_INDEX_DIR", PROCESSED_DIR / "index"))
CHUNKS_PATH = PROCESSED_DIR / "chunks.jsonl"
EMBEDDINGS_PATH = PROCESSED_DIR / "embeddings.npy"

# Models
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_DIM = 384
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
GENERATOR_MODEL = "claude-opus-4-7"

# Chunking
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100

# Retrieval
DENSE_TOP_K = 50
SPARSE_TOP_K = 50
RERANK_TOP_K = 8
RRF_K = 60

# SEC EDGAR — used to construct the User-Agent header per SEC's fair-access policy.
# The downloader expects the name and email as separate arguments; ingest.py parses this string.
SEC_USER_AGENT = "Faadil Ahmed faadil.ahmed2@gmail.com"

# ~80 tickers across 10 sectors (per spec §5; "~100" in spec narrative, 80 in the actual list)
TICKERS = [
    # Tech
    "AAPL", "MSFT", "GOOGL", "META", "AMZN", "NVDA", "TSLA", "ORCL", "CRM", "ADBE",
    # Finance
    "JPM", "BAC", "GS", "MS", "WFC", "C", "BLK", "SCHW", "AXP", "USB",
    # Healthcare
    "PFE", "JNJ", "UNH", "CVS", "MRK", "ABBV", "LLY", "BMY", "TMO", "AMGN",
    # Energy
    "XOM", "CVX", "COP", "SLB", "EOG", "PSX", "VLO", "OXY", "MPC", "KMI",
    # Consumer
    "WMT", "PG", "KO", "MCD", "NKE", "PEP", "COST", "TGT", "HD", "LOW",
    # Industrial
    "BA", "CAT", "GE", "HON", "UNP", "RTX", "LMT", "DE", "MMM", "EMR",
    # Telecom/Media
    "VZ", "T", "TMUS", "CMCSA", "NFLX", "DIS",
    # Real Estate
    "PLD", "AMT", "SPG", "EQIX",
    # Utilities
    "NEE", "SO", "DUK", "AEP",
    # Materials
    "LIN", "APD", "SHW", "FCX",
]
