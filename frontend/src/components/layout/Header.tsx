import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScopeChip } from "@/components/corpus/ScopeChip"
import { useTheme } from "@/hooks/useTheme"

interface HealthInfo {
  chunks_loaded: number
  tickers: number
}

export function Header() {
  const { theme, toggle } = useTheme()
  const [health, setHealth] = useState<HealthInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setHealth(data)
      })
      .catch(() => {
        /* swallow — badge falls back to a static label */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">SEC 10-K Q&A</h1>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {health
            ? `${health.tickers} tickers · ${health.chunks_loaded.toLocaleString()} chunks`
            : "loading…"}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <ScopeChip />
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </header>
  )
}
