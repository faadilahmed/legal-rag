# SEC 10-K Q&A — Hybrid Retrieval with Citation-Grounded Generation

A semantic search and Q&A system over ~80 SEC 10-K filings, demonstrating production-grade RAG architecture: hybrid retrieval (FAISS + BM25 fused with Reciprocal Rank Fusion), cross-encoder reranking, citation-grounded generation with Claude, RAGAS-based evaluation, and a PySpark embedding scale-up module.

## Why this project

Built after seeing the iManage MCP Server launch, this project explores the architectural pattern of governed semantic search over a corpus of business/legal documents with traceable citations.

## Architecture

```
ONE-TIME BUILD
──────────────
SEC EDGAR → ~78 10-Ks → SGML extraction → HTML → text + Item sections
  → recursive chunking (800 chars, 100 overlap, natural boundaries)
  → sentence-transformer embeddings (also: PySpark Pandas-UDF variant)
  → FAISS IndexFlatIP (dense) + BM25Okapi (sparse) indexes

QUERY TIME
──────────
question → hybrid retrieve (FAISS top-50 + BM25 top-50)
        → RRF fusion (K=60) → cross-encoder rerank (top-5)
        → Claude Opus 4.7 with citation-grounded prompt
        → cited answer + sources panel

EVALUATION
──────────
hand-labeled query set → Recall@5, MRR (retrieval)
                      → RAGAS faithfulness / answer_relevancy / context_precision (generation)
```

## Stack

| Component | Tool | Why |
|---|---|---|
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` | 384-dim, CPU-friendly, production default |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Top-K precision improvement |
| Dense retrieval | FAISS (`IndexFlatIP`) | Sub-ms on ~24k vectors |
| Sparse retrieval | BM25 (`rank-bm25`) | Catches exact terms (tickers, named entities) |
| Fusion | Reciprocal Rank Fusion (K=60) | Parameter-free, score-scale-independent |
| Generation | Claude Opus 4.7 | Citation-grounded prompting, inline `[chunk_id]` |
| Evaluation | RAGAS + hand-labeled set | Faithfulness, answer relevancy, context precision |
| Distributed compute | PySpark (Pandas UDFs) | Demonstrates scale-up pattern |
| UI | Gradio | Clean local-first interface |
| Python env | Python 3.12, uv-managed venv | Reproducible, fast |

## Corpus snapshot

- **Filings:** 78 most-recent 10-Ks pulled from SEC EDGAR, spanning 10 sectors (Tech, Finance, Healthcare, Energy, Consumer, Industrial, Telecom/Media, Real Estate, Utilities, Materials)
- **Chunks:** 24,290 total (avg ~580 chars/chunk after recursive splitting)
- **Index size:** ~37 MB FAISS + ~16 MB BM25 + ~37 MB embeddings + ~15 MB chunk metadata
- **Known gaps:** 2 single-letter tickers (C, MS) had section-detection failures and were skipped — see `docs/specs/2026-05-17-sec-10k-qa-design.md` for diagnosis. The remaining 76 tickers (~22.8k chunks) cover the eval-target sectors.

## Results

Measured on 30 eval queries spanning 11 factual, 7 comparative, and 12 multi-company aggregation queries across all 10 sectors (50 unique tickers referenced):

| Metric | Score | Notes |
|---|---|---|
| Retrieval Recall@5 | **0.833** | 25 of 30 queries have an expected ticker in the top-5 raw hybrid retrieval |
| Retrieval MRR | **0.723** | Average first-relevant-rank ≈ 1.4 |
| RAGAS faithfulness | _pending OpenAI judge wiring_ | |
| RAGAS answer_relevancy | _pending OpenAI judge wiring_ | |
| RAGAS context_precision | _pending OpenAI judge wiring_ | |

**Eval-set provenance (honesty matters):** The 30 queries were drafted by Claude (this project's own LLM), grounded in publicly known disclosures these companies routinely make in their 10-Ks. They were validated by running them against the index and inspecting hits/misses. A truly independent eval would have a human author with no exposure to the retrieval implementation write the questions. The current set is a starting point — see `data/eval/HOW_TO_LABEL.md` for the rubric to extend or replace it.

**Diagnostic from the 5 misses (full per-query trace in `data/eval/eval_results.json`):**

1. *"How do major US banks describe interest rate risk to net interest income?"* — retrieved `[BA, AMZN, KMI, WMT, TMO]`, no banks. A real failure: BM25 likely surfaced "BA" (Boeing) on the bigram "interest rate" + "Income" frequency, ahead of the bank filings that use phrasing like "NII sensitivity" or "asset/liability mismatch."
2. *"Which technology companies cite AI as both an opportunity and a regulatory risk?"* — the "both X and Y" phrasing is hard for sparse retrieval; needs query decomposition.
3. *"How do hyperscalers describe risks around AI compute infrastructure investments?"* — partial label gap (the retrieved `GOOGL` and `NVDA` chunks are arguably correct; my `expected_tickers` list omitted GOOGL).
4. *"What does Microsoft say about competition in its cloud business?"* — surfaced `ORCL` (which does have a cloud business) instead of MSFT; the embedder may be picking up "cloud competition" semantics from Oracle's framing more strongly than from Microsoft's. Could be helped by metadata-level ticker filtering for company-specific queries.
5. *"Which companies position themselves as beneficiaries of the energy transition?"* — vague, sector-spanning. Retrieved energy services companies (SLB, MPC) which are reasonable but not in the expected set.

The Recall@5 = 0.833 / MRR = 0.723 numbers are honest reflections of pre-rerank retrieval quality. The cross-encoder rerank step (verified on the seed query) further sorts within the top-50 but doesn't change Recall@5 since it operates on the retriever's candidate set.

## PySpark scale-up

The single-machine pipeline embeds 24k chunks in ~60 seconds on Apple Silicon CPU. To demonstrate the scale-up pattern, `src/spark_embed.py` re-implements the embedding stage as a distributed PySpark job using Pandas UDFs. Key design choices:

- **Pandas UDFs over regular UDFs** — Arrow batching gives the model 32-document batches per call instead of one-doc-per-call (~50× CPU throughput improvement).
- **Singleton model loading** per executor — avoids the 80 MB model reload that would otherwise happen on every partition.
- **Lineage columns** (`embedding_model`, `embedded_at`) — travel with each row so downstream consumers can reproduce or invalidate stale embeddings.
- **Repartitioning** before embedding for balanced executor work on skewed input.
- **macOS gotcha** (see `docs/SPARK_SETUP.md`): `SentenceTransformer(device="cpu")` is required inside Spark workers on Apple Silicon — the MPS GPU stack is severed by `fork()`.

Run locally:

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PYSPARK_PYTHON=$(pwd)/.venv/bin/python
python -m src.spark_embed
```

## What I'd do at scale

At iManage's scale (hundreds of millions of documents across thousands of customer organizations), the architecture changes in three ways:

1. **Ingestion** moves to PySpark on Databricks with medallion layering (Bronze for raw, Silver for cleaned/redacted, Gold for embedded).
2. **The vector store** becomes Azure AI Search or Databricks Vector Search with permission-aware filtering at the index level — the architectural pattern enabled by the iManage MCP server for governance.
3. **Evaluation** runs continuously against per-customer slices rather than ad-hoc, with drift detection on input distributions and output confidence.

The retrieval architecture itself — hybrid dense+sparse with reranking — translates directly. The operational discipline is what scales.

## Lessons learned

1. **The spec's "keep last 15 sections" heuristic broke section detection on real 10-Ks.** Replaced with: dedup by item number, prefer real heading titles over cross-reference fragments, longest-span wins. Required three interacting changes (also: keep `<table>` tags so prose isn't dropped, and anchor the `Item` regex to line start so mid-sentence cross-refs don't terminate a section).
2. **The SEC user-agent parsing in the original spec produced invalid emails.** `"Faadil Ahmed faadil@x.com".split(" ", 1)` yields `("Faadil", "Ahmed faadil@x.com")`. Fix: `rpartition(" ")` so the last space is the split point.
3. **Cross-encoder reranking visibly fixed retrieval order on the seed query.** Raw retrieval put a non-Apple chunk at rank 1; rerank promoted `AAPL_1A_35` to score 3.93 vs next-best 1.07.
4. **macOS + Spark + sentence-transformers needs `device="cpu"` explicitly.** Auto-MPS detection dies after the Spark Python worker forks, with a cryptic `XPC_ERROR_CONNECTION_INVALID` crash.

## Setup

```bash
# Python 3.12 via uv
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements.txt

cp .env.example .env  # then add ANTHROPIC_API_KEY

# One-time build (~2 minutes ingest + ~2 minutes embed on Apple Silicon)
python -m src.ingest                  # download 78 10-Ks
python scripts/build_index.py         # preprocess + chunk + embed + index

# Run evaluation
python scripts/run_eval.py

# Launch UI
python app/gradio_app.py              # opens http://127.0.0.1:7860
```

## PySpark module

```bash
# Java 17 required (Temurin on macOS via Homebrew is fine)
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PYSPARK_PYTHON=$(pwd)/.venv/bin/python
python -m src.spark_embed
```

This writes `data/processed/embeddings_spark.parquet` with the embedding + lineage columns. See `docs/SPARK_SETUP.md` for details.

## Repo layout

```
src/          pipeline modules (one responsibility each)
  config.py     paths, model names, retrieval params, ticker list, SEC user-agent
  ingest.py     SEC EDGAR download
  preprocess.py SGML → HTML → text → Item sections
  chunk.py      recursive structure-aware chunking
  embed.py      sentence-transformers wrapper
  spark_embed.py distributed embedding via Pandas UDF (scale-up demo)
  index.py      FAISS + BM25 hybrid index with save/load
  retrieve.py   hybrid retrieval + RRF fusion
  rerank.py     cross-encoder reranker
  generate.py   Claude generator with inline citations
  evaluate.py   Recall@k, MRR, RAGAS wrappers
  pipeline.py   end-to-end orchestrator

app/          Gradio UI
scripts/      build_index.py, run_eval.py
tests/        pytest tests — one file per src/ module
data/         raw/, processed/, eval/ (raw + processed gitignored)
docs/         canonical spec, design addendum (records spec corrections), plan, Spark setup
```

## Future work

- HF Spaces deploy (single command: `gradio deploy`)
- Multi-year temporal extension (5-year window per company, year-stratified retrieval)
- spaCy NER metadata layer for entity-filtered retrieval
- GraphRAG: extract company/industry/competitor edges into a property graph
- Counterfactual evaluation: remove a year/company and verify the answer correctly omits it
- Better section detection for filings that don't follow standard 10-K layout (e.g., JPM)
