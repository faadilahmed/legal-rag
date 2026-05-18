import { Badge } from "@/components/ui/badge"
import type { TraceCandidateChunk } from "@/lib/types"
import { cn } from "@/lib/utils"

import { ScoreBars } from "./ScoreBars"

interface RetrievedChunksListProps {
  candidates: TraceCandidateChunk[]
  topK: number  // how many of these are in the prompt
}

export function RetrievedChunksList({ candidates, topK }: RetrievedChunksListProps) {
  // Compute max absolute scores once per render so bars are normalized within the candidate set.
  const maxAbs = {
    dense: Math.max(1e-9, ...candidates.map((c) => Math.abs(c.dense_score ?? 0))),
    sparse: Math.max(1e-9, ...candidates.map((c) => Math.abs(c.sparse_score ?? 0))),
    rrf: Math.max(1e-9, ...candidates.map((c) => Math.abs(c.rrf_score ?? 0))),
    rerank: Math.max(1e-9, ...candidates.map((c) => Math.abs(c.rerank_score ?? 0))),
  }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h4 className="text-xs font-medium text-foreground">
          Retrieved candidates ({candidates.length})
        </h4>
        <span className="font-mono text-[10px] text-muted-foreground">
          top {topK} fed to Claude (highlighted)
        </span>
      </div>

      <CandidatesLegend />

      <div className="space-y-2">
        {candidates.map((c) => {
          const inPrompt = c.rerank_rank !== null && c.rerank_rank < topK
          return (
            <div
              key={c.chunk_id}
              className={cn(
                "rounded-md border bg-card p-2.5 transition-colors",
                inPrompt
                  ? "border-primary/60 ring-1 ring-inset ring-primary/30"
                  : "border-border",
              )}
            >
              <div className="mb-2 flex flex-wrap items-baseline gap-1.5">
                <span className="font-mono text-[11px] font-medium">
                  {c.chunk_id}
                </span>
                {inPrompt && (
                  <Badge variant="default" className="h-4 px-1.5 text-[9px]">
                    in prompt (#{(c.rerank_rank ?? 0) + 1})
                  </Badge>
                )}
                <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                  d:{c.dense_rank ?? "—"} · s:{c.sparse_rank ?? "—"} · rrf:{c.rrf_rank ?? "—"} · rr:{c.rerank_rank ?? "—"}
                </span>
              </div>
              <ScoreBars
                dense={c.dense_score}
                sparse={c.sparse_score}
                rrf={c.rrf_score}
                rerank={c.rerank_score}
                maxAbs={maxAbs}
              />
              <p className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">
                {c.text_preview}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CandidatesLegend() {
  return (
    <details className="group rounded-md border border-border bg-muted/20 p-2.5 text-[11px] text-muted-foreground">
      <summary className="cursor-pointer select-none text-foreground hover:text-foreground/80">
        How to read these candidates
      </summary>
      <div className="mt-2 space-y-2 leading-relaxed">
        <p>
          Each row is one chunk the system considered as a possible source.
          They&apos;re rendered in cross-encoder rerank order (the order they
          were finally scored), not the order they entered retrieval. The
          ones with a primary border + "in prompt" badge are the top-{" "}
          <span className="font-mono">k</span> that were actually sent to
          Claude as the answer&apos;s grounding context.
        </p>

        <div className="space-y-1.5">
          <p className="font-medium text-foreground">Score bars</p>
          <ul className="ml-3 list-disc space-y-1">
            <li>
              <span className="font-mono text-sky-400">dense</span> — cosine
              similarity between the query and chunk embeddings (range 0–1).
              Captures semantic match. A high dense score means the chunk is
              about a topic close to the query in vector space.
            </li>
            <li>
              <span className="font-mono text-amber-400">sparse</span> — BM25
              score (TF-IDF flavored, no fixed range). Captures exact-token
              overlap with the query — useful for ticker symbols, named
              entities, and regulatory jargon that dense embeddings blur.
            </li>
            <li>
              <span className="font-mono text-foreground">rrf</span> —
              reciprocal rank fusion of dense + sparse, plus an additive
              per-Item bias for substantive sections (1A / 7 / 7A / etc).
              This is the score that determines which candidates survive
              past retrieval into the rerank pool.
            </li>
            <li>
              <span className="font-mono text-emerald-400">rerank</span> —
              cross-encoder score (typically −10 to +10, log-odds-ish).
              Computed by scoring the (query, chunk) pair JOINTLY through a
              transformer — categorically more accurate than independent
              embeddings, but expensive enough that it only runs on the top
              candidates from RRF.
            </li>
          </ul>
          <p className="text-[10px]">
            Bars are normalized within this candidate set so you can visually
            compare row to row. The raw numeric value is shown on the right.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="font-medium text-foreground">
            Rank tags{" "}
            <span className="font-mono text-[10px] text-muted-foreground">
              (d:N · s:N · rrf:N · rr:N)
            </span>
          </p>
          <p>
            The numbers in the small monospaced row in each header are the
            chunk&apos;s position in each ranker&apos;s output. Lower is
            better; 0 means &ldquo;top hit&rdquo;.
          </p>
          <p>
            A dash <span className="font-mono">—</span> means the chunk
            wasn&apos;t in that ranker&apos;s top-K — common when dense and
            sparse disagree on which chunks are relevant. Chunks with both
            tags populated tend to be the most robust matches (both rankers
            agree).
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="font-medium text-foreground">Why so many candidates?</p>
          <p>
            Retrieval returns 50 candidates by default, oversampled to 150
            for risk-flavored queries so the cross-encoder has more material
            to discriminate from. From that pool, only the top {" "}
            <span className="font-mono">k</span> (usually 8) actually make it
            into Claude&apos;s prompt. The rest are kept in the trace so you
            can see what was considered and rejected.
          </p>
        </div>
      </div>
    </details>
  )
}
