import { Clock, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { TraceTimingsMs, TraceUsage } from "@/lib/types"

interface StatsStripProps {
  timings: TraceTimingsMs
  usage: TraceUsage
}

const STAGE_ORDER: (keyof TraceTimingsMs)[] = [
  "embed",
  "retrieve",
  "rerank",
  "generate",
  "followups",
]

export function StatsStrip({ timings, usage }: StatsStripProps) {
  const totalMs = STAGE_ORDER.reduce((sum, k) => sum + (timings[k] ?? 0), 0)
  return (
    <div className="flex flex-wrap gap-2 border-b border-border pb-3">
      <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
        <Clock className="h-3 w-3" />
        Total {totalMs.toLocaleString()} ms
      </Badge>
      {STAGE_ORDER.map((stage) =>
        timings[stage] !== undefined ? (
          <Badge
            key={stage}
            variant="outline"
            className="font-mono text-[10px]"
          >
            {stage} {timings[stage]?.toLocaleString()} ms
          </Badge>
        ) : null,
      )}
      <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
        <Zap className="h-3 w-3" />
        {usage.prompt_tokens.toLocaleString()} in · {usage.completion_tokens.toLocaleString()} out
      </Badge>
    </div>
  )
}
