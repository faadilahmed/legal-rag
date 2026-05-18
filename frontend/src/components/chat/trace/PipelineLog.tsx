import {
  Brain,
  CheckCircle2,
  Filter,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react"
import type { ComponentType } from "react"

import type { Trace } from "@/lib/types"

interface PipelineLogProps {
  trace: Trace
}

interface StepProps {
  index: number
  icon: ComponentType<{ className?: string }>
  title: string
  timingMs?: number
  what: string
  why: string
  active?: boolean
}

function Step({ index, icon: Icon, title, timingMs, what, why, active }: StepProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border " +
            (active
              ? "border-primary/70 bg-primary/10 text-primary"
              : "border-border bg-muted/40 text-muted-foreground")
          }
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="mt-1 w-px flex-1 bg-border" aria-hidden />
      </div>
      <div className="flex-1 pb-4">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            {String(index).padStart(2, "0")}
          </span>
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {typeof timingMs === "number" && (
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">
              {timingMs.toLocaleString()} ms
            </span>
          )}
        </div>
        <p className="mt-1 break-words text-xs leading-relaxed text-foreground">
          {what}
        </p>
        <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">
          {why}
        </p>
      </div>
    </div>
  )
}

export function PipelineLog({ trace }: PipelineLogProps) {
  // Older traces (pre-decisions) get a graceful empty state. We still
  // render the timing-only steps (Embed/Generate) because those always exist.
  const d = trace.decisions
  const timings = trace.timings_ms

  // Friendly summary strings derived from the actual run.
  const autoScopeWhat = (() => {
    if (!d) return "Decision data not captured for this trace."
    const { detected, applied, source } = d.auto_scope
    if (source === "manual") {
      return `Manual UI filter applied: { ${applied.join(", ")} }.`
    }
    if (source === "auto" && applied.length) {
      return `Detected company names in query → scoped retrieval to { ${applied.join(", ")} }.`
    }
    if (detected.length && !applied.length) {
      return `Detected { ${detected.join(", ")} } but none exist in the corpus — fell back to full corpus.`
    }
    return "No company names detected → retrieve over the full corpus."
  })()

  const riskWhat = (() => {
    if (!d) return "—"
    if (!d.risk_query.is_risk) {
      return "Query did not match any risk-flavored keyword — standard retrieval k."
    }
    const kw = d.risk_query.matched_keyword
    return `Matched risk keyword "${kw}" → flagged as risk query → 3× oversample retrieval to ${d.retrieval.k_requested} candidates.`
  })()

  const retrieveWhat = (() => {
    const n = d?.retrieval.n_candidates ?? trace.retrieval.candidates.length
    const after = trace.retrieval.n_candidates_after_filter.toLocaleString()
    const total = trace.retrieval.n_chunks_in_index.toLocaleString()
    const filterNote =
      trace.retrieval.n_candidates_after_filter !== trace.retrieval.n_chunks_in_index
        ? ` (filtered to ${after} of ${total} chunks)`
        : ` (full corpus, ${total} chunks)`
    return `Dense FAISS top + sparse BM25 top, fused via RRF (K=60) + per-Item bias map${filterNote}. ${n} candidates after fusion.`
  })()

  const rerankWhat = (() => {
    const n = d?.retrieval.n_candidates ?? trace.retrieval.candidates.length
    return `Cross-encoder scored ${n} (query, chunk) pairs. Each chunk's text was prepended with "TICKER YEAR 10-K Item X:" so the reranker sees ticker context even when the body says "the Company".`
  })()

  const selectWhat = (() => {
    if (!d) {
      return `Top ${trace.rerank.top_k} reranked chunks → Claude.`
    }
    if (d.selection.strategy === "per_ticker_quota") {
      const n = d.auto_scope.applied.length || 1
      const perT = Math.max(1, Math.floor(d.selection.top_k / n))
      return `Per-ticker quota: ${n} ticker${n > 1 ? "s" : ""} scoped, ${perT} slot${
        perT > 1 ? "s" : ""
      } each (top ${d.selection.top_k} total). Remaining slots fill with best overall.`
    }
    return `Pure rerank top-${d.selection.top_k}: no scope active, cross-encoder picks the best ${d.selection.top_k} from a broad corpus.`
  })()

  const generateWhat = (() => {
    const inTok = trace.usage?.prompt_tokens ?? 0
    const outTok = trace.usage?.completion_tokens ?? 0
    return `Claude Opus 4.7 streamed the answer. ${inTok.toLocaleString()} prompt tokens in, ${outTok.toLocaleString()} completion tokens out.`
  })()

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Pipeline log</h3>
        <p className="text-[11px] text-muted-foreground">
          Step-by-step breakdown of what the system decided and ran for this exact query.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <Step
          index={1}
          icon={Brain}
          title="Embed query"
          timingMs={timings.embed}
          what="Encoded the query as a 384-dim L2-normalized vector via sentence-transformers/all-MiniLM-L6-v2."
          why="Bi-encoder so chunk vectors are precomputed at index time; per-query cost is one model pass + a vector search."
          active
        />
        <Step
          index={2}
          icon={Filter}
          title="Auto-scope"
          what={autoScopeWhat}
          why="Company-specific queries get diluted by semantically similar chunks from other companies. The alias map (76 tickers × 2–4 aliases each) disambiguates 'so what?' → not SO, 'Goldman Sachs' → GS."
          active={d?.auto_scope.source !== "none"}
        />
        <Step
          index={3}
          icon={ShieldAlert}
          title="Risk-query classifier"
          what={riskWhat}
          why="Risk-flavored queries hit the densest sections (1A, 7, 7A) with the most overlapping vocabulary. A bigger candidate pool gives the cross-encoder room to discriminate signal from generic-risk noise."
          active={d?.risk_query.is_risk ?? false}
        />
        <Step
          index={4}
          icon={Search}
          title="Hybrid retrieve + RRF + bias"
          timingMs={timings.retrieve}
          what={retrieveWhat}
          why="RRF combines incomparable score scales (cosine 0–1 vs BM25 0–30+) using only RANKS, parameter-free. Per-Item bias nudges Risk Factors / MD&A / Market Risk chunks above procedural sections — fixes the failure where 'Insider Trading Policy' chunks outrank real market-risk content on the literal word 'trading'."
          active
        />
        <Step
          index={5}
          icon={SlidersHorizontal}
          title="Cross-encoder rerank"
          timingMs={timings.rerank}
          what={rerankWhat}
          why="Cross-encoder attends across the query/chunk boundary, much more accurate than independent embeddings but needs one forward pass per pair (~3ms each on CPU). The metadata prepend lifts chunks that say 'the Company' instead of 'Apple' — a fix from the Apple/China-risks debug session."
          active
        />
        <Step
          index={6}
          icon={CheckCircle2}
          title="Select top-k for Claude"
          what={selectWhat}
          why="Per-ticker quota prevents one company from starving the others on multi-company scoped queries. Without it, the company with more matching chunks would occupy all 8 slots and Claude would correctly refuse to answer for the missing tickers."
          active
        />
        <Step
          index={7}
          icon={Sparkles}
          title="Generate (Claude Opus 4.7)"
          timingMs={timings.generate}
          what={generateWhat}
          why="Citation-grounded prompt: every factual claim ends with an inline [chunk_id]. The model resolves multi-turn follow-ups ('what about Microsoft?') against prior conversation. Tokens stream via SSE so the UI renders as they arrive."
          active
        />
      </div>
    </div>
  )
}
