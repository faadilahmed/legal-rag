import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import type { CorpusTicker } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useScope } from "@/runtime/ScopeContext"

import { YearNode } from "./YearNode"

interface TickerNodeProps {
  ticker: CorpusTicker
  onOpenChunk: (chunkId: string) => void
}

export function TickerNode({ ticker, onOpenChunk }: TickerNodeProps) {
  const [open, setOpen] = useState(false)
  const { isTickerActive, toggleTicker } = useScope()
  const active = isTickerActive(ticker.ticker)

  return (
    <div>
      <div
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs",
          "hover:bg-accent",
        )}
      >
        <Checkbox
          checked={active}
          onCheckedChange={() => toggleTicker(ticker.ticker)}
          aria-label={`Scope to ${ticker.ticker}`}
          className="h-3 w-3"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 text-left"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 transition-transform",
              open && "rotate-90",
            )}
          />
          <span className="font-mono font-medium">{ticker.ticker}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {ticker.chunk_count.toLocaleString()}
          </span>
        </button>
      </div>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2">
          {ticker.years.map((y) => (
            <YearNode
              key={`${ticker.ticker}-${y.year ?? "any"}`}
              ticker={ticker.ticker}
              year={y}
              onOpenChunk={onOpenChunk}
            />
          ))}
        </div>
      )}
    </div>
  )
}
