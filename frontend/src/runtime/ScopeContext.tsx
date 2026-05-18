import { createContext, useCallback, useContext, useMemo, useState } from "react"

interface ScopeContextValue {
  tickers: ReadonlySet<string>
  toggle: (ticker: string) => void
  clear: () => void
  isActive: (ticker: string) => boolean
}

const ScopeContext = createContext<ScopeContextValue | null>(null)

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [tickers, setTickers] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((ticker: string) => {
    setTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }, [])

  const clear = useCallback(() => setTickers(new Set()), [])

  const value = useMemo<ScopeContextValue>(
    () => ({
      tickers,
      toggle,
      clear,
      isActive: (t) => tickers.has(t),
    }),
    [tickers, toggle, clear],
  )

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useScope(): ScopeContextValue {
  const v = useContext(ScopeContext)
  if (!v) throw new Error("useScope must be used inside ScopeProvider")
  return v
}
