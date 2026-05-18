import { useEffect, useRef, useState } from "react"
import { ChevronRight, Moon, Sun } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScopeChip } from "@/components/corpus/ScopeChip"
import { useTheme } from "@/hooks/useTheme"
import type { ThreadsState } from "@/hooks/useThreads"
import { cn } from "@/lib/utils"

interface HealthInfo {
  chunks_loaded: number
  tickers: number
}

interface HeaderProps {
  threadsState: ThreadsState
}

export function Header({ threadsState }: HeaderProps) {
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

  const activeThread =
    threadsState.threads.find((t) => t.id === threadsState.activeId) ?? null

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-muted-foreground">
          SEC 10-K Q&A
        </h1>
        {activeThread && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <ThreadTitle
              key={activeThread.id}
              title={activeThread.title}
              onRename={(t) =>
                threadsState.renameThread(activeThread.id, t)
              }
            />
          </>
        )}
        <Badge
          variant="secondary"
          className="ml-2 hidden shrink-0 font-mono text-[10px] sm:inline-flex"
        >
          {health
            ? `${health.tickers} tickers · ${health.chunks_loaded.toLocaleString()} chunks`
            : "loading…"}
        </Badge>
      </div>
      <div className="flex shrink-0 items-center gap-2">
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

interface ThreadTitleProps {
  title: string
  onRename: (newTitle: string) => Promise<void>
}

function ThreadTitle({ title, onRename }: ThreadTitleProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  // Reset the draft if the active thread switches under us.
  useEffect(() => {
    setDraft(title)
  }, [title])

  const commit = async () => {
    const next = draft.trim()
    if (next && next !== title) {
      try {
        await onRename(next)
      } catch {
        setDraft(title)
      }
    } else {
      setDraft(title)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit()
          if (e.key === "Escape") {
            setDraft(title)
            setEditing(false)
          }
        }}
        className="h-7 w-[min(420px,40vw)] text-sm"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Click to rename this conversation"
      className={cn(
        "truncate rounded-md px-1.5 py-0.5 text-sm font-medium text-foreground",
        "hover:bg-accent",
      )}
    >
      {title}
    </button>
  )
}
