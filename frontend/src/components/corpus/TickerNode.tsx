import { useState } from "react"
import { ChevronRight } from "lucide-react"

import type { CorpusTicker } from "@/lib/types"
import { cn } from "@/lib/utils"

import { ItemNode } from "./ItemNode"

interface TickerNodeProps {
  ticker: CorpusTicker
  onOpenChunk: (chunkId: string) => void
}

export function TickerNode({ ticker, onOpenChunk }: TickerNodeProps) {
  const [open, setOpen] = useState(false)
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
        <span className="font-mono font-medium">{ticker.ticker}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {ticker.chunk_count}
        </span>
      </button>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2">
          {ticker.items.map((i) => (
            <ItemNode
              key={i.item}
              ticker={ticker.ticker}
              item={i}
              onOpenChunk={onOpenChunk}
            />
          ))}
        </div>
      )}
    </div>
  )
}
