import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useScope } from "@/runtime/ScopeContext"

export function ScopeChip() {
  const { tickers, clear } = useScope()
  if (tickers.size === 0) return null
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-7 gap-1 font-mono text-xs"
      onClick={clear}
      title="Clear scope"
    >
      <span>
        Scope: {tickers.size} ticker{tickers.size === 1 ? "" : "s"}
      </span>
      <X className="h-3 w-3" />
    </Button>
  )
}
