# SEC 10-K Q&A — Hybrid Retrieval with Citation-Grounded Generation

A semantic search and Q&A web app over ~80 SEC 10-K filings, demonstrating production-grade RAG architecture: hybrid retrieval (FAISS + BM25 with RRF), cross-encoder reranking, multi-turn chat with citation-grounded generation via Claude, RAGAS-based evaluation, and a PySpark embedding scale-up module. UI is a React + assistant-ui frontend talking to a FastAPI backend.

## 🔗 Live demo

**[legal-rag-imanage-demo.faadil-ahmed-dev.com](https://legal-rag-imanage-demo.faadil-ahmed-dev.com)**

Frontend hosted on **Azure Static Web Apps** (free tier, CDN-fronted) → backend on **Azure Container Apps** (consumption tier) → **Azure Blob Storage** for the 1.1 GB index → **Azure Key Vault** for the Anthropic API key (via managed identity) → **Claude Opus 4.7** for generation.

The demo is passcode-gated to keep casual visitors from running up the Anthropic bill. Ask the project owner for the passcode if you're reviewing this as a portfolio piece.

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

QUERY TIME (server-side per turn)
─────────────────────────────────
question + history → hybrid retrieve (FAISS top-50 + BM25 top-50)
  → RRF fusion (K=60) → cross-encoder rerank (top-5)
  → Claude Opus 4.7 streaming with citation-grounded prompt + prior turns
  → SSE: sources frame first, then text deltas, then done

WEB STACK
─────────
React 18 + Vite + assistant-ui (chat primitives) + shadcn/ui (sidebar/sheet)
  ↕ /api/* (Vite proxy)
FastAPI + aiosqlite (threads + messages persisted across refresh)
  ↕ in-memory
existing src/ RAGPipeline (untouched)

EVALUATION
──────────
hand-labeled query set → Recall@5, MRR (retrieval)
                      → RAGAS faithfulness / answer_relevancy / context_precision (generation)
```

## Stack

| Component | Tool | Why |
|---|---|---|
| Frontend | React 18 + Vite 5 + TypeScript | SPA, no SSR needed with a Python backend |
| Chat UI | @assistant-ui/react 0.14 | LocalRuntime + custom adapter; data-parts for inline sources |
| UI components | shadcn/ui | Resizable, Tabs, Accordion, Sheet, Checkbox, DropdownMenu, Sonner toasts |
| Styling | Tailwind 3.4, dark mode by default | |
| Backend | FastAPI + aiosqlite | Raw SQL — two tables, no ORM |
| Streaming | SSE (assistant-ui Data Stream protocol) | Text deltas + named data parts |
| Embeddings | `sentence-transformers/all-MiniLM-L6-v2` | 384-dim, CPU-friendly, production default |
| Reranking | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Top-K precision improvement |
| Dense retrieval | FAISS (`IndexFlatIP`) | Sub-ms on ~24k vectors |
| Sparse retrieval | BM25 (`rank-bm25`) | Catches exact terms (tickers, named entities) |
| Fusion | Reciprocal Rank Fusion (K=60) | Parameter-free, score-scale-independent |
| Generation | Claude Opus 4.7 | Citation-grounded prompting, inline `[chunk_id]` |
| Evaluation | RAGAS + hand-labeled set | Faithfulness, answer relevancy, context precision |
| Distributed compute | PySpark (Pandas UDFs) | Demonstrates scale-up pattern |
| Python env | Python 3.12, uv-managed venv | Reproducible, fast |

## Web app — local dev

The frontend (Vite dev server) talks to the FastAPI backend via a `/api` proxy. Run them in two terminals:

**Terminal 1 — backend:**
```bash
source .venv/bin/activate
uvicorn backend.main:app --port 8000 --reload
```

The first start takes ~10 seconds (loads FAISS + BM25 + the embedder/cross-encoder models). Subsequent requests are sub-second.

**Terminal 2 — frontend:**
```bash
cd frontend
npm install                # first time only
npm run dev                # opens http://localhost:5173
```

Visit the URL Vite prints. The app:
- Shows a "New chat" button at the top of the left sidebar; switch tabs to "Documents" to browse the corpus by sector → ticker → Item → chunk.
- Check tickers in the Documents tab to scope retrieval to those filings only (a "Scope: N tickers ×" chip appears in the header).
- Click any source card under an assistant message to slide open the full chunk text.
- Chats persist across refreshes (SQLite at `backend/data/chat.db`).

## Setup (full first-time install)

```bash
# Python side
uv venv --python 3.12 && source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env  # add ANTHROPIC_API_KEY

# Build the index (one-time, ~3 minutes total)
python -m src.ingest              # ~2 min — download 78 10-Ks
python scripts/build_index.py     # ~1 min — preprocess + chunk + embed + index

# Frontend deps
cd frontend && npm install && cd ..
```

Then run the two-terminal dev setup above. The full web app — chat with citations, threads sidebar, document browser with scope filter — is at http://localhost:5173.

## Corpus snapshot

- **Filings:** 387 10-K annual reports pulled from SEC EDGAR (~5 most-recent years per ticker, fewer for younger filers), spanning 78 tickers across 10 sectors (Tech, Finance, Healthcare, Energy, Consumer, Industrial, Telecom/Media, Real Estate, Utilities, Materials)
- **Filing years:** 2021–2026 (with FY2022–FY2025 having full 77-78 ticker coverage; FY2026 partial because some companies haven't filed yet)
- **Chunks:** 116,639 total (avg ~550 chars/chunk after recursive splitting); chunk IDs encode lineage as `TICKER_YEAR_ITEM_N` (e.g. `AAPL_2025_1A_35`) so multi-year filings stay distinguishable
- **Index size:** ~170 MB FAISS + ~75 MB BM25 + ~170 MB embeddings + ~70 MB chunk metadata = ~480 MB total
- **Build time:** ~10 min ingest + ~5 min preprocess/chunk/embed on Apple Silicon CPU
- **Known gaps:** 2 tickers (C, MS) consistently fail section detection across all 5 years — their 10-K SGML structure doesn't match our `Item X` regex. The remaining 76 tickers' filings make up the indexed 116,639 chunks. See `docs/specs/2026-05-17-sec-10k-qa-design.md` for the section-detection diagnosis.

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
5. **Gradio is the wrong tool for ChatGPT-style UIs.** Gradio's `gr.Chatbot` is one monolithic component — no per-message customization, no proper sidebar, no modals. Replacing it with React + assistant-ui got us: collapsible threads/documents sidebars, per-message inline source expanders, dark mode by default, persistent chat history, and a "stop generating" button — all with native UX patterns that Gradio can't do cleanly. The backend was a clean separation: FastAPI wraps the existing `RAGPipeline` without modifying it (just two small additive extensions for multi-turn and ticker-filter).

## Repo layout

```
src/                  pipeline modules (unchanged from the Gradio era)
  config.py             paths, model names, retrieval params, ticker list, SEC user-agent
  ingest.py             SEC EDGAR download
  preprocess.py         SGML → HTML → text → Item sections
  chunk.py              recursive structure-aware chunking
  embed.py              sentence-transformers wrapper
  spark_embed.py        distributed embedding via Pandas UDF (scale-up demo)
  index.py              FAISS + BM25 hybrid index with save/load
  retrieve.py           hybrid retrieval + RRF fusion (+ optional ticker_filter)
  rerank.py             cross-encoder reranker
  generate.py           Claude generator with inline citations (+ multi-turn stream_chat)
  evaluate.py           Recall@k, MRR, RAGAS wrappers
  pipeline.py           end-to-end orchestrator

backend/              FastAPI app, SQLite, streaming chat orchestrator
  main.py               FastAPI factory + lifespan (loads RAGPipeline once)
  routers/              threads.py, chat.py, corpus.py
  services/             chat_service.py (orchestrator), sse.py (wire encoder), corpus_service.py
  tests/                pytest integration tests for each router

frontend/             React + Vite + Tailwind app
  src/runtime/          assistant-ui adapter (LegalRagRuntime) + ScopeContext
  src/components/chat/  Thread, AssistantMessage, SourcesPanel, SourceCard, Composer
  src/components/threads/  ThreadList, ThreadListItem (rename/delete)
  src/components/corpus/   DocumentBrowser, SectorNode, TickerNode, ItemNode, ChunkRow, ChunkSheet, ScopeChip
  src/components/layout/   AppShell (three-pane), LeftSidebar (tabs), Header (theme + scope chip)
  src/hooks/            useThreads, useCorpus, useTheme
  src/lib/              api.ts, sse.ts, types.ts, utils.ts

data/                 raw/, processed/, eval/  (raw + processed gitignored; eval set tracked)
scripts/              build_index.py, run_eval.py
tests/                pytest tests — one file per src/ module
docs/                 canonical spec, design addendum, plan, SPARK_SETUP.md
```

## Future work

- HF Spaces / Render / Fly.io deploy (Docker compose with backend + nginx for the frontend bundle)
- Multi-year temporal extension (5-year window per company, year-stratified retrieval)
- spaCy NER metadata layer for entity-filtered retrieval
- GraphRAG: extract company/industry/competitor edges into a property graph
- Counterfactual evaluation: remove a year/company and verify the answer correctly omits it
- "Cite by hover" — clicking an inline `[AAPL_1A_35]` citation in the answer text auto-opens the corresponding source card / chunk sheet
- Conversation token-budget management (truncate to last N user-assistant pairs as history grows)
