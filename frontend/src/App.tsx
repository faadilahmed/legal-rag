import { useEffect, useState } from "react"

import { AppShell } from "@/components/layout/AppShell"

interface Health {
  status: string
  chunks_loaded: number
  tickers: number
}

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/health")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: Health) => setHealth(data))
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-8">
        <h2 className="text-2xl font-semibold tracking-tight">
          Main pane (chat lands here)
        </h2>
        <p className="mt-2 text-muted-foreground">
          Phase C3 will mount the assistant-ui Thread component here. For now,
          this confirms the layout shell + theme toggle + sidebar tabs render.
        </p>
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium">Backend health</h3>
          {health && (
            <pre className="mt-2 text-xs text-muted-foreground">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
          {error && (
            <p className="mt-2 text-sm text-destructive">Error: {error}</p>
          )}
          {!health && !error && (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
