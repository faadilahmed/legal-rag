import type { SourceChunk } from "@/lib/types"

interface SourceCardProps {
  chunk: SourceChunk
  onOpen: (chunkId: string) => void
}

export function SourceCard({ chunk, onOpen }: SourceCardProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(chunk.chunk_id)}
      className="block w-full rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-xs font-medium">
          {chunk.ticker} · Item {chunk.item}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">
          score {chunk.rerank_score.toFixed(2)}
        </p>
      </div>
      {chunk.section_title && (
        <p className="mt-1 text-xs text-muted-foreground">
          {chunk.section_title}
        </p>
      )}
      <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
        {chunk.text_preview}
        {chunk.text_preview.length >= 300 ? "…" : ""}
      </p>
    </button>
  )
}
