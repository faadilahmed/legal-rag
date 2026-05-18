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

interface PipelineStage {
  id: string
  name: string
  subtitle: string
  phase: "build" | "query"
  icon: LucideIcon
  model: string | null
  why: string
  code: string
  keyFact: string
}

const STAGES: PipelineStage[] = [
  {
    id: "ingest",
    name: "Ingest",
    subtitle: "Pull 10-Ks from SEC EDGAR",
    phase: "build",
    icon: Download,
    model: "sec-edgar-downloader (5+)",
    why: "EDGAR is the SEC's public filing database — authoritative, structured, free. The downloader handles SEC's 10 req/s rate limit automatically.",
    code: `dl = Downloader(name, email, str(RAW_DIR))
for ticker in tickers:
    dl.get("10-K", ticker, limit=5)   # 5 years per ticker`,
    keyFact: "387 filings ingested in ~10 minutes (78 tickers × ~5 years).",
  },
  {
    id: "preprocess",
    name: "Preprocess",
    subtitle: "SGML → text + Item sections",
    phase: "build",
    icon: FileText,
    model: "BeautifulSoup + regex",
    why: "SEC filings arrive as SGML containers with multiple <DOCUMENT> blocks (10-K plus exhibits). We extract only the TYPE=10-K block, strip HTML, then detect 'Item X' sections with a line-anchored regex + title-score dedup (TOC entries don't beat real section headings).",
    code: `submission = filing_path.read_text(errors="ignore")
html = extract_10k_html(submission)   # type=10-K only
text = html_to_text(html)              # BS4, drop scripts/styles
sections = extract_sections(text)      # ^Item N. heading, dedup`,
    keyFact: "2 of 78 tickers (C, MS) have non-standard SGML — section detection fails on them.",
  },
  {
    id: "chunk",
    name: "Chunk",
    subtitle: "Split sections into retrieval units",
    phase: "build",
    icon: Scissors,
    model: "RecursiveCharacterTextSplitter (langchain-text-splitters)",
    why: "800 chars is the sweet spot — small enough that 5 chunks fit in Claude's context with room for the system prompt + history, big enough to preserve paragraph coherence. Recursive splitter prefers natural boundaries (\\n\\n > \\n > '. ' > ' '), so a chunk rarely cuts mid-sentence. 100-char overlap prevents queries from missing relevant content that straddles a chunk boundary.",
    code: `splitter = RecursiveCharacterTextSplitter(
    chunk_size=800, chunk_overlap=100,
    separators=["\\n\\n", "\\n", ". ", " ", ""],
)
chunks = splitter.split_text(section["text"])`,
    keyFact: "116,639 total chunks across 387 filings — avg ~302 chunks per filing.",
  },
  {
    id: "embed",
    name: "Embed",
    subtitle: "Text → 384-dim vector",
    phase: "build",
    icon: Brain,
    model: "sentence-transformers/all-MiniLM-L6-v2",
    why: "Bi-encoder: embeds query and chunk independently. You precompute chunk vectors ONCE and the per-query cost is just one embedding + a vector search. 80 MB on disk, runs on CPU, sub-second on 117k chunks. Vectors are L2-normalized so cosine similarity = dot product, letting FAISS IndexFlatIP cover both metrics with one index.",
    code: `from sentence_transformers import SentenceTransformer
model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
embeddings = model.encode(
    texts, batch_size=32, normalize_embeddings=True,
    convert_to_numpy=True,
)`,
    keyFact: "Embedding all 117k chunks takes ~60 seconds on Apple Silicon CPU.",
  },
  {
    id: "index",
    name: "Index",
    subtitle: "FAISS dense + BM25 sparse",
    phase: "build",
    icon: Database,
    model: "FAISS IndexFlatIP + rank-bm25 BM25Okapi",
    why: "Two indexes co-located. FAISS does fast inner-product search on the normalized vectors (= cosine similarity). BM25 catches exact-token matches — tickers, named entities, regulatory terms — that dense embeddings tend to blur. Empirically hybrid beats dense-only on every benchmark.",
    code: `# Dense: cosine similarity = inner product on normalized vectors
dense_index = faiss.IndexFlatIP(embeddings.shape[1])
dense_index.add(embeddings)

# Sparse: simple whitespace tokenization
tokenized = [chunk["text"].lower().split() for chunk in chunks]
sparse_index = BM25Okapi(tokenized)`,
    keyFact: "~480 MB on disk total: FAISS + BM25 + embeddings + chunk metadata.",
  },
  {
    id: "retrieve",
    name: "Retrieve",
    subtitle: "Hybrid + RRF → top 50",
    phase: "query",
    icon: Search,
    model: "Reciprocal Rank Fusion (K=60)",
    why: "Dense and sparse scores live on totally different scales (cosine ~0–1 vs BM25 ~0–30+). Weighted blending requires tuning α. RRF uses only RANKS, not raw scores: each item gets 1/(K + rank + 1) from each ranker, summed. Parameter-free; K=60 is the canonical default from the 2009 paper.",
    code: `# Dense + sparse top-50, then fuse
_, dense_idx = dense_index.search(query_emb, 50)
sparse_top = np.argsort(sparse_scores)[::-1][:50]
fused = _rrf_fuse([dense_ranked, sparse_ranked])
top_50 = sorted(fused.keys(), key=lambda x: -fused[x])[:50]`,
    keyFact: "Sub-30 ms on 117k chunks (dense + sparse + fuse, single-threaded).",
  },
  {
    id: "rerank",
    name: "Rerank",
    subtitle: "Cross-encoder top-5",
    phase: "query",
    icon: SlidersHorizontal,
    model: "cross-encoder/ms-marco-MiniLM-L-6-v2",
    why: "Cross-encoders concatenate [CLS] query [SEP] chunk_text and produce ONE relevance score per pair by attending across the boundary — much more accurate than independent embeddings. But you need one forward pass per (query, chunk) pair, so you can't use it to score 117k chunks per query. Use the bi-encoder retriever to shrink to 50, then the cross-encoder picks the best 5 of those 50.",
    code: `pairs = [(query, c["text"]) for c in candidates]
scores = cross_encoder.predict(pairs, show_progress_bar=False)
for c, s in zip(candidates, scores):
    c["rerank_score"] = float(s)
return sorted(candidates, key=lambda x: -x["rerank_score"])[:5]`,
    keyFact: "~200 ms to rerank 50 candidates on CPU.",
  },
  {
    id: "generate",
    name: "Generate",
    subtitle: "Claude streaming with citations",
    phase: "query",
    icon: Sparkles,
    model: "claude-opus-4-7 (Anthropic)",
    why: "Citation-grounded prompting: the system prompt instructs inline [chunk_id] references after each factual claim, and the rules explicitly say to draw from BOTH the freshly retrieved chunks AND the prior conversation. The model multi-turn-resolves follow-ups like 'what about Microsoft?' against the previous turn. Streaming via messages.stream — tokens land in the UI as they're produced.",
    code: `with client.messages.stream(
    model="claude-opus-4-7",
    system=CHAT_SYSTEM_PROMPT + corpus_meta,
    messages=[*history, {"role": "user", "content": context_msg}],
    max_tokens=1024,
) as stream:
    for text in stream.text_stream:
        yield sse.text_delta(text)`,
    keyFact: "End-to-end answer typically 3–5 seconds. Generation dominates; retrieval+rerank is sub-300 ms.",
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
          Code
        </p>
        <pre className="max-w-full overflow-x-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[10px] leading-relaxed text-foreground">
          {stage.code}
        </pre>
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
