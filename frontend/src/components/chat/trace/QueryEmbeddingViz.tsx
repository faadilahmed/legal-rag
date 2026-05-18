interface QueryEmbeddingVizProps {
  values: number[]  // first 24 dims of the 384-dim query embedding
}

/** Bar chart visualization of the first 24 dimensions of the query embedding.
 * Each bar's height is the abs value (normalized to the max abs in the slice);
 * bars below zero are flipped underneath the baseline so positive vs negative
 * is visually distinct. The whole thing is decorative — conveys 'this query
 * became a 384-dim vector' without trying to be a meaningful spectrum. */
export function QueryEmbeddingViz({ values }: QueryEmbeddingVizProps) {
  if (!values.length) return null
  const maxAbs = Math.max(...values.map(Math.abs)) || 1
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-foreground">
          Query embedding (first {values.length} of 384 dims)
        </h4>
        <span className="font-mono text-[10px] text-muted-foreground">
          L2-normalized, 384-dim
        </span>
      </div>
      <div className="relative flex h-16 items-center gap-0.5 rounded-md border border-border bg-card p-2">
        <div className="absolute inset-y-0 left-2 right-2 flex items-center">
          <div className="h-px w-full bg-border" />
        </div>
        {values.map((v, i) => {
          const heightPct = (Math.abs(v) / maxAbs) * 50  // each half is 50%
          const isNeg = v < 0
          return (
            <div
              key={i}
              className="relative flex-1"
              title={`dim ${i}: ${v.toFixed(4)}`}
            >
              <div
                className={`absolute left-0 right-0 ${
                  isNeg ? "top-1/2 bg-amber-500/60" : "bottom-1/2 bg-primary/70"
                } rounded-sm`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
