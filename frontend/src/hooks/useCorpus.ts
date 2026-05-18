import { useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { CorpusTree } from "@/lib/types"

let cache: CorpusTree | null = null
let inflight: Promise<CorpusTree> | null = null

async function loadOnce(): Promise<CorpusTree> {
  if (cache) return cache
  if (inflight) return inflight
  inflight = api
    .getCorpus()
    .then((t) => {
      cache = t
      return t
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function useCorpus() {
  const [tree, setTree] = useState<CorpusTree | null>(cache)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    if (cache) {
      setTree(cache)
      return
    }
    let cancelled = false
    loadOnce()
      .then((t) => {
        if (!cancelled) setTree(t)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { tree, loading, error }
}
