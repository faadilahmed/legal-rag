import { useEffect, useState } from "react"

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
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-3xl font-semibold tracking-tight">SEC 10-K Q&A</h1>
      <p className="text-muted-foreground mt-2">Frontend scaffold ready.</p>
      <div className="mt-6 p-4 rounded-lg border border-border bg-card">
        <h2 className="text-lg font-medium">Backend health</h2>
        {health && (
          <pre className="mt-2 text-sm text-muted-foreground">
            {JSON.stringify(health, null, 2)}
          </pre>
        )}
        {error && (
          <p className="mt-2 text-sm text-destructive">
            Error: {error} (is the backend running on :8000?)
          </p>
        )}
        {!health && !error && (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        )}
      </div>
    </div>
  )
}
