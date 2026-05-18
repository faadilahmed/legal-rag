import { useEffect, useState } from "react"
import { ChevronRight } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { ChunkPreview, CorpusItem } from "@/lib/types"
import { cn } from "@/lib/utils"

import { ChunkRow } from "./ChunkRow"

interface ItemNodeProps {
  ticker: string
  item: CorpusItem
  onOpenChunk: (chunkId: string) => void
}

export function ItemNode({ ticker, item, onOpenChunk }: ItemNodeProps) {
  const [open, setOpen] = useState(false)
  const [chunks, setChunks] = useState<ChunkPreview[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || chunks !== null) return
    let cancelled = false
    setLoading(true)
    api
      .listChunks(ticker, item.item, 50)
      .then((r) => {
        if (!cancelled) setChunks(r.items)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, chunks, ticker, item.item])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="font-mono">Item {item.item}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {item.chunk_count}
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
          {loading && (
            <div className="space-y-1 py-1">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {chunks?.map((c) => (
            <ChunkRow key={c.chunk_id} chunk={c} onOpen={onOpenChunk} />
          ))}
        </div>
      )}
    </div>
  )
}
