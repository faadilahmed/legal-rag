import { useState } from "react"
import { ChevronRight } from "lucide-react"

import type { CorpusSector } from "@/lib/types"
import { cn } from "@/lib/utils"

import { TickerNode } from "./TickerNode"

interface SectorNodeProps {
  sector: CorpusSector
  onOpenChunk: (chunkId: string) => void
}

export function SectorNode({ sector, onOpenChunk }: SectorNodeProps) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm font-medium hover:bg-accent"
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-90",
          )}
        />
        <span>{sector.name}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {sector.ticker_count} tickers · {sector.chunk_count.toLocaleString()}
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5">
          {sector.tickers.map((t) => (
            <TickerNode
              key={t.ticker}
              ticker={t}
              onOpenChunk={onOpenChunk}
            />
          ))}
        </div>
      )}
    </div>
  )
}
