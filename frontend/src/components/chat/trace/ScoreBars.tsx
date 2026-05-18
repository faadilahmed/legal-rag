import { cn } from "@/lib/utils"

interface ScoreBarsProps {
  /** Raw scores; pass null when the chunk wasn't in that ranker's top-k. */
  dense: number | null
  sparse: number | null
  rrf: number | null
  rerank: number | null
  /** Max abs values for normalization, supplied by the parent so all rows share scale. */
  maxAbs: { dense: number; sparse: number; rrf: number; rerank: number }
}

/** A 4-row mini bar chart. Each row is a horizontal bar showing dense/sparse/rrf/rerank
 * score normalized 0-1 within the trace's candidate set. Hover any bar → tooltip with raw. */
export function ScoreBars({ dense, sparse, rrf, rerank, maxAbs }: ScoreBarsProps) {
  const rows: { label: string; raw: number | null; max: number; color: string }[] = [
    { label: "dense", raw: dense, max: maxAbs.dense, color: "bg-sky-500" },
    { label: "sparse", raw: sparse, max: maxAbs.sparse, color: "bg-amber-500" },
    { label: "rrf", raw: rrf, max: maxAbs.rrf, color: "bg-primary" },
    { label: "rerank", raw: rerank, max: maxAbs.rerank, color: "bg-emerald-500" },
  ]
  return (
    <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-x-2 gap-y-1 text-[10px]">
      {rows.map((row) => {
        const pct = row.raw !== null && row.max > 0 ? Math.min(100, (Math.abs(row.raw) / row.max) * 100) : 0
        return (
          <div key={row.label} className="contents">
            <span className="font-mono text-muted-foreground">{row.label}</span>
            <div className="h-2 overflow-hidden rounded-sm bg-muted">
              {row.raw !== null && (
                <div
                  className={cn("h-full rounded-sm", row.color)}
                  style={{ width: `${pct}%` }}
                  title={`raw: ${row.raw.toFixed(3)}`}
                />
              )}
            </div>
            <span className="text-right font-mono text-muted-foreground">
              {row.raw !== null ? row.raw.toFixed(2) : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}
