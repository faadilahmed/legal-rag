import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useScope } from "@/runtime/ScopeContext"

export function ScopeChip() {
  const { tickers, years, clear, hasAny } = useScope()
  if (!hasAny) return null
  const parts: string[] = []
  if (tickers.size > 0) {
    parts.push(
      `${tickers.size} ticker${tickers.size === 1 ? "" : "s"}`,
    )
  }
  if (years.size > 0) {
    parts.push(`${years.size} year${years.size === 1 ? "" : "s"}`)
  }
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-7 gap-1 font-mono text-xs"
      onClick={clear}
      title="Clear scope"
    >
      <span>Scope: {parts.join(" · ")}</span>
      <X className="h-3 w-3" />
    </Button>
  )
}
