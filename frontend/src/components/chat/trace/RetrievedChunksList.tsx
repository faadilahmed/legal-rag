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
