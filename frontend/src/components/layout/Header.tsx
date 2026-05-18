import { Moon, Sun } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScopeChip } from "@/components/corpus/ScopeChip"
import { useTheme } from "@/hooks/useTheme"

export function Header() {
  const { theme, toggle } = useTheme()

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-4 py-2">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold tracking-tight">SEC 10-K Q&A</h1>
        <Badge variant="secondary" className="font-mono text-[10px]">
          76 tickers · 24,290 chunks
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
