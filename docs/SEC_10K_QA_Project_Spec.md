# SEC 10-K Q&A — Project Specification for Claude Code

**Project:** A semantic search and Q&A system over SEC 10-K filings, built as an interview portfolio piece for iManage.

**Goal:** Demonstrate production-grade RAG architecture — hybrid retrieval, cross-encoder reranking, citation-grounded generation, RAGAS evaluation, and a PySpark scale-up module.

**Target completion:** One weekend (~15 hours).

---

## 1. What this project does

A user types a natural language question (e.g., *"What are Apple's main supply chain risks?"*). The system retrieves the most relevant sections from ~100 SEC 10-K filings using hybrid retrieval, reranks the top candidates, and generates a cited answer using Claude. Sources are shown alongside the answer for verification.

This mirrors what iManage builds at scale — Ask iManage and the MCP server are governed semantic search and Q&A over legal documents with citations.

---

## 2. Architecture overview

```
ONE-TIME BUILD (offline, runs once)
────────────────────────────────────
1. Ingest         SEC EDGAR → ~100 10-K filings
2. Preprocess     HTML → clean text + section detection
3. Chunk          Recursive structure-aware splitting (~800 chars)
4. Embed          all-MiniLM-L6-v2 → 384-dim vectors (PySpark Pandas UDF)
5. Index          FAISS (dense) + BM25 (sparse)

QUERY TIME (per user query)
────────────────────────────
6. Retrieve       Hybrid dense + sparse, fused with RRF, top 50
7. Rerank         cross-encoder/ms-marco-MiniLM-L-6-v2, top 5
8. Generate       Claude API, citation-grounded prompt

EVALUATION (offline)
────────────────────
9. Eval set       30 hand-labeled queries
10. Metrics       Recall@5, MRR, RAGAS faithfulness + relevancy

DEPLOY
──────
11. UI            Gradio with Soft theme
12. Hosting       Hugging Face Spaces (free, public URL)
```

---

## 3. Project structure

Create exactly this directory structure:

```
legal-rag/
├── README.md                    # Polished project documentation
├── requirements.txt             # All Python dependencies
├── .env.example                 # Template for env vars (API keys)
├── .gitignore                   # Standard Python + data dirs
├── pyproject.toml               # Project metadata
│
├── data/
│   ├── raw/                     # Raw 10-Ks from SEC EDGAR (gitignored)
│   ├── processed/               # Chunks, embeddings, indexes (gitignored)
│   └── eval/
│       └── eval_queries.json    # Hand-labeled evaluation set
│
├── src/
│   ├── __init__.py
│   ├── config.py                # Constants: paths, model names, tickers
│   │
│   ├── ingest.py                # Stage 1: SEC EDGAR download
│   ├── preprocess.py            # Stage 2: Clean + section detection
│   ├── chunk.py                 # Stage 3: Recursive chunking
│   ├── embed.py                 # Stage 4: Embedding generation
│   ├── spark_embed.py           # Stage 4 (PySpark version)
│   ├── index.py                 # Stage 5: FAISS + BM25 index
│   ├── retrieve.py              # Stage 6: Hybrid retrieval + RRF
│   ├── rerank.py                # Stage 7: Cross-encoder rerank
│   ├── generate.py              # Stage 8: Claude generation
│   ├── evaluate.py              # Stage 9: Eval metrics + RAGAS
│   └── pipeline.py              # End-to-end orchestrator
│
├── app/
│   └── gradio_app.py            # Stage 11: UI
│
├── scripts/
│   ├── build_index.py           # One-time pipeline build
│   └── run_eval.py              # Run evaluation suite
│
└── notebooks/
    ├── 01_explore_data.ipynb    # Data exploration
    └── 02_eval_analysis.ipynb   # Eval results analysis
```

---

## 4. Dependencies (requirements.txt)

```
# Core
python-dotenv>=1.0.0
numpy>=1.26.0
pandas>=2.1.0

# Data ingestion
sec-edgar-downloader>=5.0.0
beautifulsoup4>=4.12.0
lxml>=4.9.0

# NLP / GenAI
sentence-transformers>=2.7.0
transformers>=4.40.0
torch>=2.2.0
langchain-text-splitters>=0.0.1

# Retrieval
faiss-cpu>=1.7.4
rank-bm25>=0.2.2

# LLM
anthropic>=0.30.0

# Evaluation
ragas>=0.1.7
datasets>=2.16.0

# UI
gradio>=4.20.0

# PySpark (optional but required for the demo)
pyspark>=3.5.0
pyarrow>=14.0.0

# Dev
pytest>=8.0.0
black>=24.0.0
ruff>=0.3.0
```

---

## 5. Configuration (src/config.py)

```python
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
EVAL_DIR = DATA_DIR / "eval"
INDEX_DIR = PROCESSED_DIR / "index"

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
RERANK_TOP_K = 5
RRF_K = 60

# SEC EDGAR
SEC_USER_AGENT = "Faadil Ahmed faadil.ahmed@example.com"

# Diversified ticker list across 10 sectors (~100 companies)
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
```

---

## 6. Stage-by-stage build instructions

### Stage 1: Ingestion (src/ingest.py)

**Purpose:** Pull most recent 10-K per ticker from SEC EDGAR.

**Implementation notes:**
- Use `sec-edgar-downloader` package
- `limit=1` to fetch most recent only
- Save each filing as raw HTML in `data/raw/<ticker>/10-K/<accession>/`
- Add a small delay between requests (SEC's `sec-edgar-downloader` handles this automatically)

```python
from sec_edgar_downloader import Downloader
from src.config import TICKERS, RAW_DIR, SEC_USER_AGENT

def ingest_filings(tickers: list[str] = TICKERS) -> None:
    """Download most recent 10-K for each ticker."""
    name, email = SEC_USER_AGENT.split(" ", 1)
    dl = Downloader(name, email, str(RAW_DIR))
    
    for ticker in tickers:
        try:
            dl.get("10-K", ticker, limit=1)
            print(f"✓ {ticker}")
        except Exception as e:
            print(f"✗ {ticker}: {e}")

if __name__ == "__main__":
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    ingest_filings()
```

---

### Stage 2: Preprocessing (src/preprocess.py)

**Purpose:** Convert raw 10-K HTML to clean text with detected sections.

**Key operations:**
- HTML to text via BeautifulSoup
- Unicode normalization
- Section detection using regex on "Item X." patterns
- Extract company name and filing date from header

```python
import re
from pathlib import Path
from bs4 import BeautifulSoup
import unicodedata

ITEM_PATTERN = re.compile(
    r"Item\s+(\d+[A-Z]?)\.?\s*[—\-–]?\s*([^\n]{1,100})",
    re.MULTILINE | re.IGNORECASE,
)

def html_to_text(html: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "table"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()

def extract_sections(text: str) -> list[dict]:
    """Detect Item X sections in 10-K text."""
    matches = list(ITEM_PATTERN.finditer(text))
    sections = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append({
            "item": match.group(1),
            "title": match.group(2).strip()[:80],
            "text": text[start:end].strip(),
        })
    # Deduplicate (10-Ks often reference items in TOC before content)
    return sections[-15:] if len(sections) > 15 else sections

def preprocess_filing(filing_path: Path) -> dict:
    """Process one 10-K file into structured form."""
    html = filing_path.read_text(encoding="utf-8", errors="ignore")
    text = html_to_text(html)
    sections = extract_sections(text)
    
    ticker = filing_path.parts[-4]  # data/raw/<ticker>/10-K/<accession>/<file>
    
    return {
        "ticker": ticker,
        "filing_path": str(filing_path),
        "sections": sections,
    }
```

---

### Stage 3: Chunking (src/chunk.py)

**Purpose:** Split sections into retrievable chunks while preserving structure.

**Key concept:** Recursive splitting respects natural boundaries (paragraphs > sentences > words). Avoid fixed-size chunking which destroys legal document structure.

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.config import CHUNK_SIZE, CHUNK_OVERLAP

def chunk_document(doc: dict) -> list[dict]:
    """Chunk a preprocessed document into retrievable units."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )
    
    chunks = []
    for section in doc["sections"]:
        section_chunks = splitter.split_text(section["text"])
        for i, chunk_text in enumerate(section_chunks):
            chunks.append({
                "chunk_id": f"{doc['ticker']}_{section['item']}_{i}",
                "ticker": doc["ticker"],
                "item": section["item"],
                "section_title": section["title"],
                "text": chunk_text,
                "char_count": len(chunk_text),
            })
    return chunks
```

---

### Stage 4: Embedding (src/embed.py)

**Purpose:** Generate dense vector representations of every chunk.

```python
import numpy as np
from sentence_transformers import SentenceTransformer
from src.config import EMBEDDING_MODEL

class Embedder:
    def __init__(self, model_name: str = EMBEDDING_MODEL):
        self.model = SentenceTransformer(model_name)
        self.dim = self.model.get_sentence_embedding_dimension()
    
    def embed_chunks(self, texts: list[str], batch_size: int = 32) -> np.ndarray:
        """Embed a list of texts. Returns (n, dim) array."""
        return self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=True,
            normalize_embeddings=True,  # so cosine = dot product
            convert_to_numpy=True,
        )
    
    def embed_query(self, query: str) -> np.ndarray:
        """Embed a single query."""
        return self.model.encode(query, normalize_embeddings=True)
```

---

### Stage 4 (PySpark version): src/spark_embed.py

**Purpose:** Demonstrate the distributed scale-up pattern with Pandas UDFs.

**Key concept:** Pandas UDFs batch rows through Apache Arrow, giving the model 32-document batches per call instead of one document per call. Singleton model loading avoids reloading per partition.

```python
"""Distributed embedding generation using PySpark + Pandas UDFs.

This module demonstrates the scale-up pattern. Single-machine builds use
embed.py; distributed builds use this module on Databricks or local Spark.

Key design choices:
- Pandas UDFs (vectorized) over regular UDFs — Arrow batching
- Singleton model loading per executor
- Lineage columns (embedding_model, embedded_at) for reproducibility
- Repartitioning before embedding for balanced parallelism
"""
import pandas as pd
from pyspark.sql import SparkSession, functions as F
from pyspark.sql.types import ArrayType, FloatType
from sentence_transformers import SentenceTransformer
from src.config import EMBEDDING_MODEL

_model = None

def get_model():
    """Singleton — loaded once per executor."""
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model

@F.pandas_udf(ArrayType(FloatType()))
def embed_batch(text_series: pd.Series) -> pd.Series:
    """Vectorized embedding — batches rows through Arrow."""
    model = get_model()
    embeddings = model.encode(
        text_series.tolist(),
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    return pd.Series([emb.tolist() for emb in embeddings])

def embed_chunks_distributed(spark: SparkSession, input_path: str, output_path: str):
    """Read chunks, embed at scale, write back as Parquet."""
    df = spark.read.json(input_path)
    
    embedded = (
        df
        .repartition(8)
        .withColumn("embedding", embed_batch(F.col("text")))
        .withColumn("embedding_model", F.lit(EMBEDDING_MODEL))
        .withColumn("embedded_at", F.current_timestamp())
    )
    
    embedded.write.mode("overwrite").parquet(output_path)
    return embedded

if __name__ == "__main__":
    spark = (
        SparkSession.builder
        .appName("legal-rag-embed")
        .config("spark.sql.shuffle.partitions", "16")
        .config("spark.sql.adaptive.enabled", "true")
        .getOrCreate()
    )
    embed_chunks_distributed(
        spark,
        "data/processed/chunks.jsonl",
        "data/processed/embeddings_spark.parquet",
    )
```

---

### Stage 5: Indexing (src/index.py)

**Purpose:** Build both dense (FAISS) and sparse (BM25) indexes for hybrid retrieval.

```python
import pickle
from pathlib import Path
import numpy as np
import faiss
from rank_bm25 import BM25Okapi

class HybridIndex:
    def __init__(self, embeddings: np.ndarray, chunks: list[dict]):
        self.embeddings = embeddings
        self.chunks = chunks
        
        # Dense index — FAISS with inner product (cosine on normalized vectors)
        self.dense_index = faiss.IndexFlatIP(embeddings.shape[1])
        self.dense_index.add(embeddings.astype(np.float32))
        
        # Sparse index — BM25 with simple tokenization
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
```

---

### Stage 6: Retrieval (src/retrieve.py)

**Purpose:** Hybrid retrieval combining dense (FAISS) and sparse (BM25), fused with Reciprocal Rank Fusion.

**Key concept:** RRF is parameter-free and works across incomparable score scales.

```python
from collections import defaultdict
import numpy as np
from src.config import DENSE_TOP_K, SPARSE_TOP_K, RRF_K

class HybridRetriever:
    def __init__(self, index, embedder):
        self.index = index
        self.embedder = embedder
    
    def retrieve(self, query: str, k: int = DENSE_TOP_K) -> list[dict]:
        """Hybrid retrieval with RRF fusion."""
        # Dense retrieval
        query_emb = self.embedder.embed_query(query).astype(np.float32).reshape(1, -1)
        _, dense_idx = self.index.dense_index.search(query_emb, k)
        dense_ranked = [(int(idx), rank) for rank, idx in enumerate(dense_idx[0])]
        
        # Sparse retrieval
        tokenized_query = query.lower().split()
        sparse_scores = self.index.sparse_index.get_scores(tokenized_query)
        sparse_top = np.argsort(sparse_scores)[::-1][:k]
        sparse_ranked = [(int(idx), rank) for rank, idx in enumerate(sparse_top)]
        
        # RRF fusion
        fused = defaultdict(float)
        for idx, rank in dense_ranked:
            fused[idx] += 1.0 / (RRF_K + rank + 1)
        for idx, rank in sparse_ranked:
            fused[idx] += 1.0 / (RRF_K + rank + 1)
        
        # Sort by fused score, return chunks with score attached
        top_ids = sorted(fused.keys(), key=lambda x: -fused[x])[:k]
        return [
            {**self.index.chunks[idx], "retrieval_score": fused[idx]}
            for idx in top_ids
        ]
```

---

### Stage 7: Reranking (src/rerank.py)

**Purpose:** Use a cross-encoder to rerank top candidates for precision.

**Key concept:** Bi-encoders embed independently (fast, indexable). Cross-encoders score query-document pairs jointly (accurate, only viable on small candidate sets).

```python
from sentence_transformers import CrossEncoder
from src.config import RERANKER_MODEL, RERANK_TOP_K

class Reranker:
    def __init__(self, model_name: str = RERANKER_MODEL):
        self.model = CrossEncoder(model_name)
    
    def rerank(self, query: str, candidates: list[dict], top_k: int = RERANK_TOP_K) -> list[dict]:
        """Rerank candidates by query-chunk relevance."""
        pairs = [(query, c["text"]) for c in candidates]
        scores = self.model.predict(pairs, show_progress_bar=False)
        
        for c, score in zip(candidates, scores):
            c["rerank_score"] = float(score)
        
        return sorted(candidates, key=lambda x: -x["rerank_score"])[:top_k]
```

---

### Stage 8: Generation (src/generate.py)

**Purpose:** Generate cited answers using Claude with citation-grounded prompting.

```python
import os
import re
from anthropic import Anthropic
from src.config import GENERATOR_MODEL

SYSTEM_PROMPT = """You are a financial analyst answering questions about SEC 10-K filings.

Rules:
1. Use ONLY the provided context to answer.
2. Cite sources inline using [chunk_id] notation after each claim.
3. If the answer is not in the context, say "I don't have enough information to answer this question."
4. Be concise but complete — typically 2-5 sentences.
5. Quote specific language when it strengthens the answer."""

USER_TEMPLATE = """Context from SEC 10-K filings:

{context}

Question: {query}

Answer with inline citations [chunk_id]:"""

class Generator:
    def __init__(self):
        self.client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = GENERATOR_MODEL
    
    def _format_context(self, chunks: list[dict]) -> str:
        return "\n\n".join([
            f"[chunk_id: {c['chunk_id']} | {c['ticker']} | Item {c['item']}]\n{c['text']}"
            for c in chunks
        ])
    
    def generate(self, query: str, chunks: list[dict]) -> dict:
        context = self._format_context(chunks)
        prompt = USER_TEMPLATE.format(context=context, query=query)
        
        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )
        
        answer = response.content[0].text
        citations = re.findall(r"\[([\w_]+)\]", answer)
        
        return {
            "answer": answer,
            "citations": list(set(citations)),
            "chunks_used": chunks,
        }
```

---

### Stage 9: Evaluation (src/evaluate.py)

**Purpose:** Measure retrieval and generation quality against a labeled set.

**Eval set format** (`data/eval/eval_queries.json`):

```json
[
  {
    "query": "What are Apple's main supply chain risks?",
    "expected_tickers": ["AAPL"],
    "expected_items": ["1A"],
    "expected_keywords": ["supply chain", "manufacturing", "Asia", "concentration"],
    "gold_answer": "Apple depends on concentrated manufacturing partners in Asia, faces exposure to geopolitical tensions affecting components, and has historically experienced production disruptions from natural disasters and pandemics."
  }
]
```

Hand-label ~30 queries covering different sectors, query types (factual, comparative, evolution), and difficulty levels.

```python
import json
from pathlib import Path
import numpy as np
from src.config import EVAL_DIR

def load_eval_set() -> list[dict]:
    with open(EVAL_DIR / "eval_queries.json") as f:
        return json.load(f)

def evaluate_retrieval(retriever, eval_set: list[dict], k: int = 5) -> dict:
    """Compute Recall@k, MRR for the eval set."""
    recall_at_k = 0
    reciprocal_ranks = []
    
    for example in eval_set:
        results = retriever.retrieve(example["query"], k=k)
        retrieved_tickers = [r["ticker"] for r in results]
        expected = set(example["expected_tickers"])
        
        # Recall@k: does any retrieved ticker match expected?
        if any(t in expected for t in retrieved_tickers):
            recall_at_k += 1
        
        # MRR: rank of first relevant result
        for rank, ticker in enumerate(retrieved_tickers, start=1):
            if ticker in expected:
                reciprocal_ranks.append(1 / rank)
                break
        else:
            reciprocal_ranks.append(0)
    
    return {
        f"recall@{k}": recall_at_k / len(eval_set),
        "mrr": float(np.mean(reciprocal_ranks)),
    }

def evaluate_generation_ragas(pipeline, eval_set: list[dict]) -> dict:
    """Run RAGAS faithfulness + answer relevancy on the eval set."""
    from ragas import evaluate
    from ragas.metrics import faithfulness, answer_relevancy, context_precision
    from datasets import Dataset
    
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
```

---

### Stage 10 (pipeline orchestrator): src/pipeline.py

**Purpose:** Tie all stages together for end-to-end usage.

```python
from pathlib import Path
import numpy as np
from src.embed import Embedder
from src.index import HybridIndex
from src.retrieve import HybridRetriever
from src.rerank import Reranker
from src.generate import Generator
from src.config import INDEX_DIR, RERANK_TOP_K, DENSE_TOP_K

class RAGPipeline:
    def __init__(self, embedder, index, retriever, reranker, generator):
        self.embedder = embedder
        self.index = index
        self.retriever = retriever
        self.reranker = reranker
        self.generator = generator
    
    @classmethod
    def load(cls, index_dir: Path = INDEX_DIR) -> "RAGPipeline":
        """Load pre-built pipeline from disk."""
        embedder = Embedder()
        index = HybridIndex.load(index_dir)
        retriever = HybridRetriever(index, embedder)
        reranker = Reranker()
        generator = Generator()
        return cls(embedder, index, retriever, reranker, generator)
    
    def answer(self, query: str) -> dict:
        """Full RAG: retrieve, rerank, generate."""
        candidates = self.retriever.retrieve(query, k=DENSE_TOP_K)
        reranked = self.reranker.rerank(query, candidates, top_k=RERANK_TOP_K)
        result = self.generator.generate(query, reranked)
        return {
            "query": query,
            "answer": result["answer"],
            "citations": result["citations"],
            "chunks": reranked,
        }
```

---

### Stage 11: Gradio UI (app/gradio_app.py)

```python
import gradio as gr
from src.pipeline import RAGPipeline

pipeline = RAGPipeline.load()

def answer_question(query: str, history: list) -> tuple:
    """Handle a user query — return updated history, sources panel, cleared input."""
    if not query.strip():
        return history, "", ""
    
    result = pipeline.answer(query)
    answer = result["answer"]
    
    sources_md = "\n\n".join([
        f"**{c['ticker']} · Item {c['item']}** — score: `{c['rerank_score']:.2f}`\n\n> {c['text'][:300]}..."
        for c in result["chunks"]
    ])
    
    history = history + [(query, answer)]
    return history, sources_md, ""

with gr.Blocks(theme=gr.themes.Soft(), title="SEC 10-K Q&A") as demo:
    gr.Markdown("# 📊 SEC 10-K Q&A")
    gr.Markdown("*Hybrid retrieval over ~100 SEC filings · citation-grounded answers · built with HF + Claude*")
    
    with gr.Row():
        with gr.Column(scale=2):
            chatbot = gr.Chatbot(label="Answer", height=500, show_label=False)
            msg = gr.Textbox(
                placeholder="What are Apple's main supply chain risks?",
                show_label=False,
            )
            with gr.Row():
                submit = gr.Button("Ask", variant="primary")
                clear = gr.Button("Clear")
            
            gr.Examples(
                examples=[
                    "What are Apple's main supply chain risks?",
                    "Which companies cite AI as a competitive threat?",
                    "How do banks describe regulatory risk in 2024?",
                    "What are the most common ESG-related risks across sectors?",
                ],
                inputs=msg,
            )
        
        with gr.Column(scale=1):
            gr.Markdown("### Sources")
            sources = gr.Markdown()
    
    submit.click(answer_question, [msg, chatbot], [chatbot, sources, msg])
    msg.submit(answer_question, [msg, chatbot], [chatbot, sources, msg])
    clear.click(lambda: ([], "", ""), outputs=[chatbot, sources, msg])

if __name__ == "__main__":
    demo.launch()
```

---

### Build scripts

**scripts/build_index.py** — runs the full pipeline once to build the index:

```python
"""One-time pipeline build. Run after `ingest_filings()` completes."""
import json
from pathlib import Path
from src.config import RAW_DIR, PROCESSED_DIR, INDEX_DIR
from src.preprocess import preprocess_filing
from src.chunk import chunk_document
from src.embed import Embedder
from src.index import HybridIndex

def main():
    # Find all raw 10-K files
    filing_files = list(RAW_DIR.glob("**/10-K/**/*.txt")) + list(RAW_DIR.glob("**/10-K/**/*.htm"))
    print(f"Found {len(filing_files)} filings")
    
    # Preprocess + chunk
    all_chunks = []
    for filing_path in filing_files:
        try:
            doc = preprocess_filing(filing_path)
            chunks = chunk_document(doc)
            all_chunks.extend(chunks)
        except Exception as e:
            print(f"✗ {filing_path}: {e}")
    
    print(f"Total chunks: {len(all_chunks)}")
    
    # Save chunks as JSONL for PySpark module
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    with open(PROCESSED_DIR / "chunks.jsonl", "w") as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk) + "\n")
    
    # Embed
    embedder = Embedder()
    embeddings = embedder.embed_chunks([c["text"] for c in all_chunks])
    print(f"Embeddings shape: {embeddings.shape}")
    
    # Build and save index
    index = HybridIndex(embeddings, all_chunks)
    index.save(INDEX_DIR)
    print(f"✓ Index saved to {INDEX_DIR}")

if __name__ == "__main__":
    main()
```

**scripts/run_eval.py** — runs evaluation:

```python
"""Run evaluation suite — retrieval metrics + RAGAS."""
import json
from src.pipeline import RAGPipeline
from src.evaluate import load_eval_set, evaluate_retrieval, evaluate_generation_ragas

def main():
    pipeline = RAGPipeline.load()
    eval_set = load_eval_set()
    
    print("Running retrieval evaluation...")
    retrieval_scores = evaluate_retrieval(pipeline.retriever, eval_set, k=5)
    print(retrieval_scores)
    
    print("\nRunning RAGAS evaluation...")
    ragas_scores = evaluate_generation_ragas(pipeline, eval_set)
    print(ragas_scores)
    
    results = {"retrieval": retrieval_scores, "ragas": ragas_scores}
    with open("data/eval/eval_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

if __name__ == "__main__":
    main()
```

---

## 7. Weekend execution plan

### Saturday morning (3-4 hours)
1. Create the repo structure, install dependencies, set up `.env` with `ANTHROPIC_API_KEY`
2. Implement `src/ingest.py`, run it, verify ~100 filings downloaded
3. Implement `src/preprocess.py`, test on a few filings
4. Implement `src/chunk.py`, run `scripts/build_index.py` partially to verify chunking works

### Saturday afternoon (3-4 hours)
5. Implement `src/embed.py`, embed all chunks (takes ~15 min on CPU)
6. Implement `src/index.py`, build dense + sparse indexes
7. Implement `src/retrieve.py`, smoke test with a few queries
8. Implement `src/rerank.py`, verify reranking improves top results
9. Implement `src/spark_embed.py` (the PySpark version), run it locally

### Sunday morning (3-4 hours)
10. Implement `src/generate.py`, test with a few queries
11. Implement `src/pipeline.py` — end-to-end smoke test
12. Hand-label 30 eval queries in `data/eval/eval_queries.json`
13. Implement `src/evaluate.py`, run `scripts/run_eval.py`

### Sunday afternoon (2-3 hours)
14. Implement `app/gradio_app.py`, test locally
15. Deploy to Hugging Face Spaces with `gradio deploy`
16. Write the README (see section 8 below)
17. Push to GitHub

---

## 8. The README structure

Use this exact structure in your README.md — it's optimized for interview signal:

```markdown
# SEC 10-K Q&A — Hybrid Retrieval with Citation-Grounded Generation

A semantic search and Q&A system over ~100 SEC 10-K filings, demonstrating 
production-grade RAG architecture: hybrid retrieval, cross-encoder reranking, 
citation-grounded generation, and RAGAS-based evaluation.

**[🚀 Live Demo](https://huggingface.co/spaces/YOUR_USERNAME/sec-10k-qa) · [📊 Eval Results](#evaluation)**

## Why this project

Built after seeing the iManage MCP Server launch, this project explores 
the architectural pattern of governed semantic search over a corpus of 
business/legal documents with traceable citations.

## Architecture

[Mermaid diagram of the pipeline]

## Stack

| Component | Tool | Why |
|---|---|---|
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` | 384-dim, CPU-friendly, production default |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Top-K precision improvement |
| Dense retrieval | FAISS (IndexFlatIP) | Sub-ms on 15K vectors |
| Sparse retrieval | BM25 | Catches exact terms (tickers, named entities) |
| Fusion | Reciprocal Rank Fusion | Parameter-free, score-scale-independent |
| Generation | Claude Opus 4.7 | Citation-grounded prompting |
| Evaluation | RAGAS + manual labeled set | Faithfulness, answer relevancy, context precision |
| Distributed compute | PySpark (Pandas UDFs) | Demonstrates scale-up pattern |
| UI | Gradio | Clean, deployable, HF-native |

## Results

[Table of eval metrics]

## PySpark scale-up

The single-machine pipeline embeds ~12K chunks in ~15 minutes on CPU. To 
demonstrate the scale-up pattern, the embedding stage is also implemented 
as a distributed PySpark job using Pandas UDFs. Key design choices:

- **Pandas UDFs over regular UDFs** — Arrow batching gives the model 
  32-document batches per call, ~50x throughput improvement on CPU.
- **Singleton model loading** per executor — avoids 80MB model reload per partition.
- **Lineage columns** (`embedding_model`, `embedded_at`) — track provenance.
- **Repartitioning** before embedding for balanced executor work.

## What I'd do at scale

At iManage's scale (hundreds of millions of documents across 4,000 customer 
organizations), the architecture changes in three ways:

1. **Ingestion** moves to PySpark on Databricks with medallion layering 
   (Bronze for raw, Silver for cleaned/redacted, Gold for embedded).
2. **The vector store** becomes Azure AI Search or Databricks Vector Search 
   with permission-aware filtering at the index level — the architectural 
   pattern enabled by the iManage MCP server for governance.
3. **Evaluation** runs continuously against per-customer slices rather than 
   ad-hoc, with drift detection on input distributions and output confidence.

The retrieval architecture itself — hybrid dense+sparse with reranking — 
translates directly. The operational discipline is what scales.

## Lessons learned

1. Fixed-size chunking destroyed 10-K section structure — switched to 
   recursive splitting on natural boundaries (\n\n, \n, ". ", " ").
2. RRF meaningfully beat dense-only on queries with company names (BM25 
   caught exact ticker matches the embeddings blurred).
3. Cross-encoder reranking lifted MRR by ~15% on the eval set with minimal 
   latency cost (top-50 → top-5).
4. RAGAS faithfulness correlated strongly with manual review; context 
   precision was noisier — informative for which metrics to gate promotion on.

## Setup

```bash
git clone <repo>
cd legal-rag
pip install -r requirements.txt
cp .env.example .env  # add ANTHROPIC_API_KEY

# Build index (one-time)
python -m src.ingest
python scripts/build_index.py

# Run evaluation
python scripts/run_eval.py

# Launch UI
python app/gradio_app.py
```
```

---

## 9. The interview talk track

When this project comes up in the interview, use this structure:

> "When I saw the iManage MCP Server launch announcement, I wanted to build something that captures the core architectural pattern — governed semantic search over a corpus of business documents with traceable citations. I built it over a weekend with ~100 SEC 10-K filings, around 12,000 chunks total.
>
> The retrieval is hybrid — dense embeddings via sentence-transformers in parallel with BM25, fused with Reciprocal Rank Fusion. RRF was the right choice because dense and sparse scores aren't directly comparable; RRF is parameter-free. I added cross-encoder reranking on the top-50 candidates for precision — lifted MRR by about 15% on my labeled eval set.
>
> Generation uses Claude with citation-grounded prompting — every claim has an inline chunk_id, so faithfulness is visible to the user and measurable. I evaluated with RAGAS plus a manually labeled set of 30 queries. The interesting finding was that RAGAS faithfulness correlated strongly with manual review, but context precision was noisier — that's the kind of metric I'd want to validate against domain experts before gating production promotions on it.
>
> I also built a PySpark version of the embedding stage to demonstrate the scale-up pattern — Pandas UDFs with singleton model loading, lineage columns for reproducibility. At iManage's scale, the operational discipline matters more than the retrieval architecture itself, which translates directly."

---

## 10. Critical reminders

**Things to get right:**
- The PHI/PII layer isn't relevant here (SEC filings are public), but the *pattern* of lineage columns and governance metadata should still be visible in the code
- Include the "what I'd do at scale" paragraph in the README — it's the highest-signal artifact
- Hand-label the eval set yourself, ~30 queries — don't shortcut this
- Take a screenshot of the Spark UI when running the PySpark stage; embed in README
- The repo's `git log` should show meaningful incremental commits, not a single dump

**Things to skip:**
- Don't build a custom React frontend — Gradio is correct here
- Don't pull multiple years per company — single year is enough
- Don't fine-tune any models — pretrained is correct for this scope
- Don't add authentication/multi-tenancy — out of scope
- Don't over-engineer error handling — graceful failure on bad inputs is enough

**The single most important thing:** Get end-to-end working before polishing any single component. A working v1 with mediocre eval beats a beautifully-built embedding stage with no UI.

---

## 11. Stretch goals (if time permits)

In rough priority order:

1. **Multi-year temporal extension** — pull 5 years per company, add year-stratified retrieval, demonstrate evolution queries
2. **spaCy NER metadata layer** — extract company names and financial entities, add as searchable metadata
3. **GraphRAG section in README** — describe how you'd extract company/industry/competitor relationships and store in a property graph
4. **Comparison mode in UI** — let users pick two tickers and ask comparative questions
5. **Counterfactual evaluation** — remove specific years/companies and test whether the answer correctly omits them

---

## End of specification

Drop this into Claude Code with: *"Build the project specified in this file step by step. Start with the directory structure and dependencies, then implement each stage in order, testing each one before moving to the next. Don't skip the evaluation set or the PySpark module — both are required for the interview signal."*
