import { useEffect, useState } from "react"
import {
  Download,
  FileText,
  Scissors,
  Brain,
  Database,
  Search,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface CodeBlock {
  label: string
  snippet: string
}

interface PipelineStage {
  id: string
  name: string
  subtitle: string
  phase: "build" | "query"
  icon: LucideIcon
  model: string | null
  why: string
  io: string
  tradeoffs: string
  code: CodeBlock[]
  keyFact: string
}

const STAGES: PipelineStage[] = [
  {
    id: "ingest",
    name: "Ingest",
    subtitle: "Pull 10-Ks from SEC EDGAR",
    phase: "build",
    icon: Download,
    model: "sec-edgar-downloader (5.x)",
    why: "EDGAR is the SEC's official public-filing system — every annual report from every U.S. public company since the 90s, free, structured, and unambiguously canonical. We pull each ticker's last 5 annual 10-K filings (one per fiscal year), which gives us multi-year coverage so the system can answer 'how has this changed since 2022?' style questions. The sec-edgar-downloader library handles SEC's 10 requests/second rate limit automatically and parses the EDGAR full-text-submission format so we get a single full-submission.txt per filing on disk, ready for preprocessing.",
    io: "Input: ticker symbols (e.g. 'AAPL'). Output: data/raw/sec-edgar-filings/<TICKER>/10-K/<accession>/full-submission.txt — one SGML envelope per filing, typically 1–60 MB.",
    tradeoffs: "Alternative was scraping investor-relations sites or buying a feed (Bloomberg, FactSet). Both add latency and dependency surface for marginal gains here. The downside of EDGAR is that each filing is a raw SGML envelope wrapping dozens of <DOCUMENT> blocks (the 10-K plus all its exhibits) — preprocess has to unwrap them.",
    code: [
      {
        label: "Downloader setup + per-ticker fetch",
        snippet: `from sec_edgar_downloader import Downloader

dl = Downloader(name, email, str(RAW_DIR))
for ticker in tickers:
    # 5 years per ticker; lib enforces SEC's 10 req/s rate limit
    dl.get("10-K", ticker, limit=5)`,
      },
      {
        label: "Output layout on disk",
        snippet: `data/raw/sec-edgar-filings/
└── AAPL/
    └── 10-K/
        ├── 0000320193-22-000108/
        │   └── full-submission.txt   # SGML envelope, ~12 MB
        ├── 0000320193-23-000106/
        ├── 0000320193-24-000123/
        └── ...`,
      },
      {
        label: "Year parsing from accession number",
        snippet: `# Format: CIK-YYfiled-SEQ (e.g. 0000320193-24-000123)
_ACCESSION_RE = re.compile(r"^(\\d{10})-(\\d{2})-(\\d{6})$")

def _resolve_year(filing_path: Path) -> int:
    for part in filing_path.parts:
        if m := _ACCESSION_RE.match(part):
            yy = int(m.group(2))
            return 1900 + yy if yy >= 70 else 2000 + yy
    return 0`,
      },
    ],
    keyFact: "387 filings cached, ~11 GB on disk. One-time cost: ~10 minutes for all 76 tickers × 5 years.",
  },
  {
    id: "preprocess",
    name: "Preprocess",
    subtitle: "SGML → text + Item sections",
    phase: "build",
    icon: FileText,
    model: "BeautifulSoup + line-anchored Item regex",
    why: "Every 10-K filing is an SGML envelope with multiple <DOCUMENT> blocks (the 10-K body plus exhibits like EX-13 / EX-21 / EX-99). We extract only the <DOCUMENT TYPE='10-K'> block, strip HTML with BeautifulSoup (keeping tables — SEC filings use table cells for prose layout), and normalize unicode. Then we segment the body into 'Item X.' sections via a line-anchored regex. Each Item header appears multiple times in a filing (TOC, content, cross-references) — we deduplicate by keeping the occurrence with the longest span whose title isn't a cross-reference fragment.",
    io: "Input: full-submission.txt (1–60 MB SGML). Output: a Python dict with ticker, year, and an ordered list of section dicts {item, title, text} — Items 1, 1A, 1B, 1C, 2, …, 16 typically present.",
    tradeoffs: "We deliberately keep tables because Apple and others format paragraph content inside table cells; stripping tables loses Risk Factors entirely. The cost: financial tables come through too, mostly as numbers separated by spaces. The span cap (500k chars) was tuned to fit massive bank Risk Factors sections — earlier cap of 100k dropped JPM/GS/BAC Item 1A content entirely.",
    code: [
      {
        label: "Top-level pipeline (preprocess_filing)",
        snippet: `submission = filing_path.read_text(encoding="utf-8", errors="ignore")
html = extract_10k_html(submission)   # find <DOCUMENT TYPE=10-K>
text = html_to_text(html)              # BS4, drop scripts/styles
sections = extract_sections(text)      # ^Item N. heading, dedup`,
      },
      {
        label: "Pull only the 10-K body out of the SGML envelope",
        snippet: `DOCUMENT_BLOCK = re.compile(r"<DOCUMENT>(.*?)</DOCUMENT>",
                            re.DOTALL | re.IGNORECASE)
DOC_TYPE = re.compile(r"<TYPE>([^\\n<]+)", re.IGNORECASE)

def extract_10k_html(submission: str) -> str:
    for block in DOCUMENT_BLOCK.findall(submission):
        if (m := DOC_TYPE.search(block)) and m.group(1).strip().upper() == "10-K":
            return DOC_TEXT.search(block).group(1)
    return blocks[0]  # fallback`,
      },
      {
        label: "Item-header regex (anchored to line start)",
        snippet: `# Matches "Item 1." / "Item 1A." / "Item 7A —"
# Line anchor prevents cross-references like "Part II, Item 7"
# from terminating a real section prematurely.
ITEM_PATTERN = re.compile(
    r"^\\s*Item\\s+(\\d+[A-Z]?)\\.?\\s*[—\\-–]?\\s*([^\\n]{1,100})",
    re.MULTILINE | re.IGNORECASE,
)`,
      },
      {
        label: "Dedup: pick the best occurrence per Item",
        snippet: `# Each Item appears multiple times (TOC, content, cross-refs).
# Keep the occurrence with the longest span whose title isn't
# a cross-reference fragment. Cap spans at 500k chars to avoid
# runaway captures when a section's terminating Item is missing.
for span in spans:
    item = span["item"]
    if item not in by_item:
        by_item[item] = span
    elif (span["score"], span["length"]) > (current["score"], current["length"]):
        by_item[item] = span`,
      },
    ],
    keyFact: "Raised MAX_SECTION_CHARS from 100k → 500k to recover bank Risk Factors content. Result: 8 of 14 previously-broken tickers (JPM, GS, BAC, BLK, CRM, CVS, FCX, META) now have full 1A coverage.",
  },
  {
    id: "chunk",
    name: "Chunk",
    subtitle: "Split sections into retrieval units",
    phase: "build",
    icon: Scissors,
    model: "RecursiveCharacterTextSplitter (langchain-text-splitters)",
    why: "Chunks must be small enough that the top-8 fit in Claude's context with room for the system prompt + multi-turn history, big enough to preserve paragraph coherence so the reranker has substantive content to score. 800 chars (~200 tokens) is the sweet spot: 8 chunks × 200 tokens = 1.6k tokens of context, leaving ~190k tokens free for prompt + history + answer in Claude Opus's 200k window. The Recursive splitter walks a separator priority list (\\n\\n > \\n > '. ' > ' ' > '') so a chunk rarely cuts mid-sentence. 100-char overlap means a key sentence near a boundary appears in both adjacent chunks, so a query matching it can't be truncated out.",
    io: "Input: a section dict with full Item text (thousands to hundreds of thousands of chars). Output: a list of chunk dicts {chunk_id: 'TICKER_YEAR_ITEM_N', ticker, year, item, section_title, text}.",
    tradeoffs: "Fixed-window over semantic chunking (LangChain's SemanticChunker or LlamaIndex's hierarchical splitters). Semantic chunking groups sentences by embedding similarity — better paragraph coherence, but ~10× slower at build time and the gains evaporate above ~200 tokens. For 10-K filings, paragraph boundaries are dense enough that the recursive splitter rarely breaks mid-thought.",
    code: [
      {
        label: "Splitter configuration",
        snippet: `from langchain_text_splitters import RecursiveCharacterTextSplitter

# 800 chars (~200 tokens) so 8 chunks fit in Claude's context
# with room for system prompt + multi-turn history.
splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=100,
    separators=["\\n\\n", "\\n", ". ", " ", ""],  # priority order
)`,
      },
      {
        label: "Chunking each section + metadata stamping",
        snippet: `chunks: list[dict] = []
for section in doc["sections"]:
    parts = splitter.split_text(section["text"])
    for i, text in enumerate(parts):
        chunks.append({
            "chunk_id": f"{ticker}_{year}_{section['item']}_{i}",
            "ticker": ticker,
            "year": year,
            "item": section["item"],
            "section_title": section["title"],
            "text": text,
        })`,
      },
      {
        label: "Chunk-ID format",
        snippet: `# Stable, human-legible chunk IDs encode full lineage:
#
#   AAPL_2025_1A_35
#   ^^^^ ^^^^ ^^ ^^
#   |    |    |  └── ordinal within (ticker, year, item)
#   |    |    └───── 10-K Item (1A = Risk Factors)
#   |    └────────── fiscal year
#   └─────────────── ticker symbol
#
# Used as the inline citation token: [AAPL_2025_1A_35]`,
      },
    ],
    keyFact: "264,449 total chunks across 387 filings (avg ~683 per filing). Of these, 47,640 are Item 1A (Risk Factors) — the section most queries actually hit.",
  },
  {
    id: "embed",
    name: "Embed",
    subtitle: "Text → 384-dim L2-normalized vector",
    phase: "build",
    icon: Brain,
    model: "sentence-transformers/all-MiniLM-L6-v2",
    why: "This is the bi-encoder half of the retrieval. A bi-encoder embeds query and chunk independently as fixed-size vectors, so chunk vectors are precomputed ONCE at build time and a per-query cost reduces to one embedding pass + a vector search. all-MiniLM-L6-v2 is a 6-layer distillation of BERT — 384 dimensions, ~80 MB on disk, ~14 batches/sec on Apple Silicon CPU. It's the smallest model that consistently lands above 0.80 on the MTEB retrieval benchmark. We L2-normalize the output so cosine similarity equals dot product; that lets FAISS use IndexFlatIP (a single index) instead of needing both cosine and dot-product variants.",
    io: "Input: a list of chunk text strings. Output: a numpy float32 matrix of shape (n_chunks, 384), L2-normalized along axis=1.",
    tradeoffs: "Could use a bigger encoder (e5-large at 1024-dim, BGE-large at 1024-dim) for ~3–5% MTEB gain at ~10× index size. For 264k chunks, the bigger embeddings would push the index past 1 GB and slow per-query latency without changing the answers we get. Multi-vector models like ColBERT score even higher but at 100× index size — overkill for this corpus.",
    code: [
      {
        label: "Build-time: embed all chunks once",
        snippet: `from sentence_transformers import SentenceTransformer

model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
embeddings = model.encode(
    texts,
    batch_size=32,
    normalize_embeddings=True,    # cosine sim = dot product
    convert_to_numpy=True,
)  # shape: (264449, 384), dtype=float32`,
      },
      {
        label: "Query-time: embed a single query",
        snippet: `class Embedder:
    def embed_query(self, query: str) -> np.ndarray:
        # Same model, batch of one; output already L2-normalized
        return self.model.encode(
            [query],
            normalize_embeddings=True,
            convert_to_numpy=True,
        )[0]  # shape: (384,), ~50 ms on CPU`,
      },
      {
        label: "Verify the normalization invariant",
        snippet: `# Every embedding vector has unit L2 norm — this lets us use
# a single FAISS IndexFlatIP for what is geometrically cosine
# similarity. Confirm at index-build time:
norms = np.linalg.norm(embeddings, axis=1)
assert np.allclose(norms, 1.0, atol=1e-5)`,
      },
    ],
    keyFact: "Embedding all 264k chunks takes ~9 minutes on Apple Silicon CPU. Resulting embeddings.npy is 406 MB.",
  },
  {
    id: "index",
    name: "Index",
    subtitle: "FAISS dense + BM25 sparse",
    phase: "build",
    icon: Database,
    model: "FAISS IndexFlatIP + rank-bm25 BM25Okapi",
    why: "Two parallel indexes over the same chunk array. FAISS IndexFlatIP does EXACT inner-product search over normalized vectors — sub-millisecond on 264k vectors because everything is in-memory float32. BM25Okapi is a classic TF-IDF-style sparse ranker; we tokenize each chunk's text with text.lower().split() and BM25 indexes the term-frequencies. The hybrid is critical: dense embeddings blur exact-token matches (ticker symbols, named entities, regulatory phrases like 'CCAR' or 'CET1'), and BM25 catches those literally. Empirically hybrid beats dense-only on every benchmark we ran.",
    io: "Input: embeddings matrix (n, 384) + the chunk dicts. Output: four files written to data/processed/index/ — faiss.index (mmap-friendly), bm25.pkl (token frequencies + IDF), chunks.pkl (metadata array), embeddings.npy (raw vectors).",
    tradeoffs: "IndexFlatIP is exact but O(n) per query. At 264k vectors that's still <1 ms, so the precision is free. Above ~1M vectors we'd switch to HNSW (O(log n), tunable recall) or IVF-PQ (much smaller, ~95% recall). For BM25 we use rank-bm25 — a pure-Python implementation. A C-backed alternative like Elasticsearch or PISA would be faster but adds infrastructure for marginal gain at this scale.",
    code: [
      {
        label: "Build the FAISS dense index",
        snippet: `import faiss

# Inner-product = cosine similarity on normalized vectors.
# IndexFlatIP is EXACT (not approximate) — fine at this scale.
dense_index = faiss.IndexFlatIP(embeddings.shape[1])  # 384
dense_index.add(embeddings)                            # adds 264k vectors`,
      },
      {
        label: "Build the BM25 sparse index",
        snippet: `from rank_bm25 import BM25Okapi

# Simple whitespace tokenization + lowercase. BM25 weights tokens
# by TF in this doc × IDF across the corpus; rare words dominate
# the score, which is exactly what we want for ticker matches.
tokenized = [chunk["text"].lower().split() for chunk in chunks]
sparse_index = BM25Okapi(tokenized)`,
      },
      {
        label: "Persist + mmap on startup",
        snippet: `# Save (once, after build)
faiss.write_index(dense_index, str(INDEX_DIR / "faiss.index"))
pickle.dump(sparse_index, open(INDEX_DIR / "bm25.pkl", "wb"))
pickle.dump(chunks, open(INDEX_DIR / "chunks.pkl", "wb"))

# Load (every backend startup; sub-second via mmap)
dense_index = faiss.read_index(str(INDEX_DIR / "faiss.index"),
                                faiss.IO_FLAG_MMAP)
sparse_index = pickle.load(open(INDEX_DIR / "bm25.pkl", "rb"))`,
      },
    ],
    keyFact: "~1.1 GB on disk total: FAISS (406 MB) + BM25 (178 MB) + embeddings (406 MB) + chunk metadata (172 MB). Backend mmaps everything on startup so first-query latency is sub-second.",
  },
  {
    id: "retrieve",
    name: "Retrieve",
    subtitle: "Hybrid + RRF + scope + bias",
    phase: "query",
    icon: Search,
    model: "FAISS + BM25 → Reciprocal Rank Fusion (K=60) + ITEM_BIAS map",
    why: "Dense and sparse scores live on incomparable scales (cosine ~0–1 vs BM25 ~0–30+), so weighted score-blending requires tuning α and works badly across query types. RRF sidesteps this: each item gets 1/(K + rank + 1) added FROM EACH RANKER IT APPEARS IN, summed. K=60 is the canonical default from the 2009 paper. On top of RRF we apply a small additive per-Item bias (1A +0.010, 7 +0.010, 7A +0.007, 1/1C/8 +0.003) — this fixed a real bug where BM25 ranked 'Insider Trading Policy' chunks ahead of Risk Factors chunks for queries containing 'trading'. We also auto-scope by company-name detection (the query 'JPMorgan and Goldman Sachs…' restricts retrieval to JPM+GS chunks before fusion) and, for risk-flavored queries, oversample the retrieval pool 3× so the reranker has a deeper candidate set.",
    io: "Input: query text (+ optional ticker/year filters). Output: top-150 (risk queries) or top-50 (other queries) chunk dicts, each carrying retrieval_score, dense_score/rank, sparse_score/rank, rrf_rank — all visible in the per-message Trace inspector.",
    tradeoffs: "RRF ignores score magnitude — a chunk that's the #1 hit by both dense and sparse gets the same fusion contribution as #1 by one ranker only doubled, not boosted further. This is mostly fine; we recover magnitude via the cross-encoder downstream. Auto-scope is a heuristic — for 'how does this industry compare' queries we deliberately skip it. Per-Item bias is hand-tuned; a learned reranker would do better but adds training cost.",
    code: [
      {
        label: "Auto-scope: detect company names in the query",
        snippet: `# detect_query_tickers("How do JPMorgan and Goldman Sachs...")
# → {"JPM", "GS"}
# Handles ambiguous tickers: "so what?" does NOT match SO; the
# bare uppercase form is required for short common-word tickers.

if not ticker_set:
    detected = detect_query_tickers(user_content)
    valid = {t for t in detected
             if any(c["ticker"] == t for c in chunks)}
    if valid:
        ticker_set = valid  # apply as retrieval filter`,
      },
      {
        label: "Hybrid dense + sparse + RRF fusion",
        snippet: `# Dense top-k (FAISS over-fetches when filters are active)
_, dense_idx = dense_index.search(query_emb, max(k*10, 200))
dense_ranked = [(idx, rank) for rank, idx in enumerate(dense_hits)]

# Sparse top-k (BM25 over the full or filtered corpus)
sparse_top = np.argsort(sparse_scores)[::-1][:SPARSE_TOP_K]
sparse_ranked = [(idx, rank) for rank, idx in enumerate(sparse_top)]

# RRF: parameter-free; K=60 is the canonical default
fused: dict[int, float] = defaultdict(float)
for ranked_list in [dense_ranked, sparse_ranked]:
    for chunk_id, rank in ranked_list:
        fused[chunk_id] += 1.0 / (RRF_K + rank + 1)`,
      },
      {
        label: "Per-Item bias map (fixes the 'Insider Trading' bug)",
        snippet: `# RRF scores typically 0.01–0.05. Bias values are tuned to be
# meaningful but not dominant — they nudge ties toward
# substantive sections, never override genuine relevance.
ITEM_BIAS: dict[str, float] = {
    "1":  0.003,   # Business
    "1A": 0.010,   # Risk Factors — most-queried section
    "1C": 0.003,   # Cybersecurity
    "7":  0.010,   # MD&A
    "7A": 0.007,   # Quantitative Market Risk Disclosures
    "8":  0.003,   # Financial Statements
}
for chunk_id in list(fused.keys()):
    fused[chunk_id] += ITEM_BIAS.get(chunks[chunk_id]["item"], 0.0)

top_k = sorted(fused.keys(), key=lambda x: -fused[x])[:k]`,
      },
      {
        label: "Risk-query 3× oversample",
        snippet: `_RISK_KEYWORDS = ("risk", "risks", "trading", "market-making",
                  "exposure", "credit", "liquidity", "capital",
                  "regulatory", "litigation", "cyber", "supply chain", ...)

def _is_risk_query(q: str) -> bool:
    q = " " + q.lower() + " "
    return any(kw in q for kw in _RISK_KEYWORDS)

# Risk queries get a deeper candidate pool so the cross-encoder
# has more to choose from. Capped at 150 for rerank latency.
retrieve_k = DENSE_TOP_K * 3 if risk_query else DENSE_TOP_K`,
      },
    ],
    keyFact: "Sub-30 ms on 264k chunks (dense + sparse + fuse + bias). Without the ITEM_BIAS, generic 'trading' chunks from Item 18 (Insider Trading Policy) would consistently outrank real market-risk chunks from 1A/7/7A.",
  },
  {
    id: "rerank",
    name: "Rerank",
    subtitle: "Cross-encoder picks top-8",
    phase: "query",
    icon: SlidersHorizontal,
    model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
    why: "Cross-encoders are categorically more accurate than bi-encoders: they concatenate [CLS] query [SEP] chunk_text and run a SINGLE forward pass that attends across the boundary, producing one relevance score per pair. The catch is that you need one model pass PER (query, chunk) pair, so you can't use it to score the whole corpus per query. The two-stage pattern — bi-encoder retrieves 50–150 candidates, cross-encoder picks the top-k — is the standard recipe. We also prepend each chunk's text with 'TICKER YEAR 10-K Item X: ' before scoring: a fix discovered while debugging a query like 'Apple's discussion of China-related risks', where chunks that say 'the Company' instead of 'Apple' were scored -9 (effectively dropped) while chunks happening to contain a literal 'Apple Inc.' page header scored +2. The metadata prepend levels the playing field.",
    io: "Input: query text + the 50–150 retrieved candidates. Output: same candidates with rerank_score attached, sorted descending; top-8 fed to Claude.",
    tradeoffs: "ms-marco-MiniLM-L-6-v2 is small and fast (~3 ms/pair on CPU) but trained on MS MARCO, a Q&A passage-ranking dataset. It generalizes OK to 10-Ks but isn't trained on financial language specifically. A domain-tuned reranker (e.g. fine-tuned on FinQA pairs) would do better. We chose breadth over depth for a portfolio demo.",
    code: [
      {
        label: "Metadata prepend (the Apple/China fix)",
        snippet: `def _scoreable_text(chunk: dict) -> str:
    """Prepend chunk metadata so the reranker sees ticker context.

    10-K chunks often say "the Company" instead of "Apple Inc."
    Without a header, the cross-encoder scored those at -9 for
    "Apple's discussion of..." queries — effectively dropping them.
    """
    header = f"{chunk['ticker']} {chunk.get('year', '')} "
    header += f"10-K Item {chunk['item']}"
    return f"{header}: {chunk['text']}"`,
      },
      {
        label: "Score all (query, chunk) pairs jointly",
        snippet: `from sentence_transformers import CrossEncoder

self.model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")

# Each pair runs one forward pass; ~3ms per pair on CPU
pairs = [(query, _scoreable_text(c)) for c in candidates]
scores = self.model.predict(pairs, show_progress_bar=False)
for c, score in zip(candidates, scores):
    c["rerank_score"] = float(score)
sorted_candidates = sorted(candidates,
                            key=lambda x: -x["rerank_score"])`,
      },
      {
        label: "Per-ticker quota (multi-company scoped queries)",
        snippet: `# Without this, when 2+ tickers are scoped, the one with more
# matching chunks tends to occupy all 8 reranked slots — and
# Claude correctly refuses to answer for the missing tickers.
def _apply_per_ticker_quota(reranked, top_k, tickers):
    per_ticker = max(1, top_k // len(tickers))
    by_ticker = defaultdict(list)
    for c in reranked:
        if c["ticker"] in tickers:
            by_ticker[c["ticker"]].append(c)

    quota = []
    for t in sorted(tickers):
        quota.extend(by_ticker[t][:per_ticker])
    quota.sort(key=lambda c: -c["rerank_score"])
    # Fill remaining slots with best overall not in quota
    return (quota + [c for c in reranked
                     if c["chunk_id"] not in {q["chunk_id"] for q in quota}])[:top_k]`,
      },
    ],
    keyFact: "~3 ms per (query, chunk) pair × 150 pairs ≈ 450 ms on CPU. The metadata-prepend fix lifted Apple/China-mentioning chunks from rerank rank 100+ down to 15–66.",
  },
  {
    id: "generate",
    name: "Generate",
    subtitle: "Claude streaming with citations",
    phase: "query",
    icon: Sparkles,
    model: "claude-opus-4-7 (Anthropic)",
    why: "Citation-grounded prompting: the system prompt instructs inline [chunk_id] references after each factual claim, lists the corpus shape (76 tickers, 5 years per ticker, 264k chunks), and explicitly says draw from BOTH the freshly retrieved chunks AND the prior conversation. The user message embeds the 8 reranked chunks as 'Context from SEC 10-K filings: [chunk_id: AAPL_2025_1A_35 | …] <text>' blocks before the question. Multi-turn resolution is free — 'what about Microsoft?' against a prior Apple turn correctly retrieves Microsoft chunks while reusing the prior context shape. Streaming via messages.stream lands tokens in the UI as they're produced through the SSE wire format (0:text deltas / 2:typed data parts / d:done / 3:error).",
    io: "Input: 8 reranked chunks + multi-turn history + system prompt + the user's question. Output: streaming text tokens emitted via SSE; on completion, the full trace (query embedding preview, all candidates with score breakdowns, prompt, timings, token usage) persists to SQLite for the Trace inspector to render.",
    tradeoffs: "Opus 4.7 is the highest-capability Claude model — citation discipline is strong, multi-turn reasoning is reliable. The cost is latency (~3–5s end-to-end) and per-token cost. Sonnet would be ~2× faster and ~5× cheaper for ~10% quality loss on this kind of synthesis — a fair trade if scaling to high QPS but unnecessary for a single-user demo.",
    code: [
      {
        label: "Context block format (sent as the user turn)",
        snippet: `# Each retrieved chunk is wrapped with its full lineage so the
# model can both cite [chunk_id] and reason about year/section.
Context from SEC 10-K filings:

[chunk_id: AAPL_2025_1A_35 | ticker: AAPL | year: 2025 | item: 1A]
The Company remains subject to significant risks of supply shortages
and price increases that can materially adversely affect...

[chunk_id: AAPL_2024_1A_8 | ticker: AAPL | year: 2024 | item: 1A]
...

Current question: What are Apple's main supply chain risks?`,
      },
      {
        label: "System prompt (citation contract)",
        snippet: `CHAT_SYSTEM_PROMPT = """You are a financial analyst answering
questions about SEC 10-K filings. Rules:

1. Every factual claim MUST end with an inline [chunk_id] citation
   referring to one of the retrieved chunks. No exceptions.
2. If the retrieved chunks don't contain the answer, say so plainly.
   Don't fabricate; don't infer from general knowledge.
3. Multi-turn: a follow-up like 'what about Microsoft?' resolves
   against the prior turn's question — answer in the same shape.
4. Use the corpus metadata below to answer meta-questions about
   what filings you have access to.
"""`,
      },
      {
        label: "Stream tokens via SSE",
        snippet: `with pipeline.generator.stream_chat(
    query=user_content, chunks=reranked,
    history=history_msgs, extra_system=corpus_meta,
) as stream:
    for text in stream.text_stream:
        yield sse.text_delta(text)           # 0:"<chunk>"
    final = stream.get_final_message()

yield sse.data_part("status", {"phase": "done"})  # 2:{...}
yield sse.data_part("metadata", {"db_message_id": persisted.id})
yield sse.data_part("followups", {"questions": followups})
yield sse.done("stop", usage)                     # d:{...}`,
      },
      {
        label: "SSE wire format (assistant-ui Data Stream protocol)",
        snippet: `# Each frame is a single line. Prefix tells the frontend how
# to interpret it — assistant-ui's runtime knows this protocol.
0:"Apple's main supply chain risks include..."   # text delta
0:" component shortages and..."                  # text delta
2:{"type":"sources","value":{"chunks":[...]}}    # typed data part
2:{"type":"status","value":{"phase":"generating"}}
2:{"type":"metadata","value":{"db_message_id":"..."}}
2:{"type":"followups","value":{"questions":[...]}}
d:{"finishReason":"stop","usage":{...}}          # done`,
      },
    ],
    keyFact: "Typical end-to-end answer: 3–5 seconds. Generation dominates; embed + retrieve + rerank combined is sub-500 ms. Every assistant message persists with its full trace (~50–80 KB) — click the microscope icon to see what produced any answer.",
  },
]

export function PipelineDiagram() {
  const [activeId, setActiveId] = useState<string>(STAGES[0]!.id)
  const active = STAGES.find((s) => s.id === activeId)!

  // Keyboard nav: arrow keys cycle stages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const idx = STAGES.findIndex((s) => s.id === activeId)
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        setActiveId(STAGES[(idx + 1) % STAGES.length]!.id)
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        setActiveId(STAGES[(idx - 1 + STAGES.length) % STAGES.length]!.id)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [activeId])

  return (
    <div className="min-w-0 space-y-6">
      <p className="text-xs text-muted-foreground">
        Click any stage to see what it does. Use arrow keys to cycle.
      </p>

      {/* Diagram — 4-column grid, wraps to 2 rows so all 8 stages fit
          inside the modal without horizontal scroll. Reading order is
          left-to-right, top-to-bottom. */}
      <div className="grid grid-cols-4 gap-x-2 gap-y-3">
        {STAGES.map((stage, i) => (
          <StageBox
            key={stage.id}
            stage={stage}
            active={stage.id === activeId}
            index={i}
            onClick={() => setActiveId(stage.id)}
          />
        ))}
      </div>

      {/* Phase legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500/70" />
          Build-time (runs once)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
          Query-time (runs per turn)
        </span>
      </div>

      {/* Detail panel for the active stage */}
      <StageDetail stage={active} />
    </div>
  )
}

function StageBox({
  stage,
  active,
  index,
  onClick,
}: {
  stage: PipelineStage
  active: boolean
  index: number
  onClick: () => void
}) {
  const Icon = stage.icon
  const phaseRing =
    stage.phase === "build"
      ? "ring-sky-500/40"
      : "ring-emerald-500/40"
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center rounded-lg border bg-card p-3 text-center transition-all",
        active
          ? `border-primary ring-2 ring-inset ${phaseRing}`
          : "border-border hover:bg-accent",
      )}
    >
      <span className="absolute left-1.5 top-1 text-[9px] font-mono text-muted-foreground/60">
        {index + 1}
      </span>
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          stage.phase === "build" ? "text-sky-500" : "text-emerald-500",
        )}
      />
      <p className="mt-2 text-[11px] font-semibold text-foreground">
        {stage.name}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[9px] text-muted-foreground">
        {stage.subtitle}
      </p>
    </button>
  )
}

function StageDetail({ stage }: { stage: PipelineStage }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {stage.name}
            </h3>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                stage.phase === "build"
                  ? "bg-sky-500/15 text-sky-400"
                  : "bg-emerald-500/15 text-emerald-400",
              )}
            >
              {stage.phase === "build" ? "build-time" : "query-time"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{stage.subtitle}</p>
        </div>
      </div>

      {stage.model && (
        <p className="mt-3 break-words font-mono text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Model / lib:</span>{" "}
          {stage.model}
        </p>
      )}

      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Why
        </p>
        <p className="break-words text-xs leading-relaxed text-foreground">
          {stage.why}
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Inputs / Outputs
        </p>
        <p className="break-words text-xs leading-relaxed text-foreground">
          {stage.io}
        </p>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Tradeoffs
        </p>
        <p className="break-words text-xs leading-relaxed text-foreground">
          {stage.tradeoffs}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Code
        </p>
        <div className="space-y-3">
          {stage.code.map((block, i) => (
            <div key={i} className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">
                <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded bg-muted/60 font-mono text-[9px] text-foreground">
                  {i + 1}
                </span>
                {block.label}
              </p>
              <pre className="max-w-full overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-foreground">
                {block.snippet}
              </pre>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-primary">
          Key fact
        </p>
        <p className="mt-1 break-words text-xs text-foreground">{stage.keyFact}</p>
      </div>
    </div>
  )
}
