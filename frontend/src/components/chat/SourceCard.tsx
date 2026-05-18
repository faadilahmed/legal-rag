import { useEffect, useRef } from "react"

import { useCitationOptional } from "@/components/chat/CitationContext"
import type { SourceChunk } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SourceCardProps {
  chunk: SourceChunk
  onOpen: (chunkId: string) => void
}

export function SourceCard({ chunk, onOpen }: SourceCardProps) {
  const cite = useCitationOptional()
  const ref = useRef<HTMLButtonElement>(null)
  const highlighted = cite?.hoveredChunkId === chunk.chunk_id

  // Register the card's DOM node so the citation pill in the answer text can
  // imperatively scrollIntoView when its chunk_id is hovered.
  useEffect(() => {
    cite?.registerCardRef(chunk.chunk_id, ref.current)
    return () => cite?.registerCardRef(chunk.chunk_id, null)
  }, [cite, chunk.chunk_id])

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(chunk.chunk_id)}
      className={cn(
        "block w-full rounded-md border bg-card p-3 text-left transition-all",
        highlighted
          ? "border-primary/60 bg-accent ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
          : "border-border hover:bg-accent",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-xs font-medium">
          {chunk.ticker}
          {chunk.year ? ` · FY${chunk.year}` : ""} · Item {chunk.item}
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
