import { createContext, useCallback, useContext, useMemo, useState } from "react"

interface ScopeContextValue {
  tickers: ReadonlySet<string>
  years: ReadonlySet<number>
  toggleTicker: (ticker: string) => void
  toggleYear: (year: number) => void
  clear: () => void
  isTickerActive: (ticker: string) => boolean
  isYearActive: (year: number) => boolean
  /** True when at least one ticker OR year is active. Used by ScopeChip. */
  hasAny: boolean
}

const ScopeContext = createContext<ScopeContextValue | null>(null)

export function ScopeProvider({ children }: { children: React.ReactNode }) {
  const [tickers, setTickers] = useState<Set<string>>(() => new Set())
  const [years, setYears] = useState<Set<number>>(() => new Set())

  const toggleTicker = useCallback((ticker: string) => {
    setTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }, [])

  const toggleYear = useCallback((year: number) => {
    setYears((prev) => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setTickers(new Set())
    setYears(new Set())
  }, [])

  const value = useMemo<ScopeContextValue>(
    () => ({
      tickers,
      years,
      toggleTicker,
      toggleYear,
      clear,
      isTickerActive: (t) => tickers.has(t),
      isYearActive: (y) => years.has(y),
      hasAny: tickers.size > 0 || years.size > 0,
    }),
    [tickers, years, toggleTicker, toggleYear, clear],
  )

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useScope(): ScopeContextValue {
  const v = useContext(ScopeContext)
  if (!v) throw new Error("useScope must be used inside ScopeProvider")
  return v
}
