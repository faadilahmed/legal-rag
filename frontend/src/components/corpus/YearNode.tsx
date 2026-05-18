import { useState } from "react"
import { ChevronRight } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import type { CorpusYear } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useScope } from "@/runtime/ScopeContext"

import { ItemNode } from "./ItemNode"

interface YearNodeProps {
  ticker: string
  year: CorpusYear
  onOpenChunk: (chunkId: string) => void
}

export function YearNode({ ticker, year, onOpenChunk }: YearNodeProps) {
  const [open, setOpen] = useState(false)
  const { isYearActive, toggleYear } = useScope()
  // year.year is null for the legacy single-year corpus where we never had
  // a year. In that case render as a transparent passthrough — no checkbox,
  // no extra nesting label, just bubble the items up to the ticker level.
  const hasYear = year.year !== null && year.year !== undefined
  const active = hasYear ? isYearActive(year.year as number) : false

  if (!hasYear) {
    // Render items inline without an intermediate year row.
    return (
      <>
        {year.items.map((i) => (
          <ItemNode
            key={i.item}
            ticker={ticker}
            item={i}
            year={null}
            onOpenChunk={onOpenChunk}
          />
        ))}
      </>
    )
  }

  return (
    <div>
      <div className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs hover:bg-accent">
        <Checkbox
          checked={active}
          onCheckedChange={() => toggleYear(year.year as number)}
          aria-label={`Scope to FY${year.year}`}
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
          <span className="font-mono">FY{year.year}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {year.chunk_count.toLocaleString()}
          </span>
        </button>
      </div>
      {open && (
        <div className="ml-4 mt-1 space-y-0.5 border-l border-border pl-2">
          {year.items.map((i) => (
            <ItemNode
              key={i.item}
              ticker={ticker}
              item={i}
              year={year.year}
              onOpenChunk={onOpenChunk}
            />
          ))}
        </div>
      )}
    </div>
  )
}
