import { useCallback, useEffect, useState } from "react"

import { api } from "@/lib/api"
import type { Thread } from "@/lib/types"

const ACTIVE_KEY = "legal-rag.thread_id"

export function useThreads() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeId, setActiveIdState] = useState<string | null>(
    () => window.localStorage.getItem(ACTIVE_KEY),
  )
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.listThreads()
      setThreads(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setActiveId = useCallback((id: string) => {
    window.localStorage.setItem(ACTIVE_KEY, id)
    setActiveIdState(id)
  }, [])

  const createThread = useCallback(async (): Promise<Thread> => {
    const t = await api.createThread()
    setThreads((prev) => [t, ...prev])
    setActiveId(t.id)
    return t
  }, [setActiveId])

  const renameThread = useCallback(async (id: string, title: string) => {
    const updated = await api.renameThread(id, title)
    setThreads((prev) => prev.map((t) => (t.id === id ? updated : t)))
  }, [])

  const deleteThread = useCallback(
    async (id: string) => {
      await api.deleteThread(id)
      setThreads((prev) => prev.filter((t) => t.id !== id))
      if (activeId === id) {
        // Pick another thread or create a new one
        const remaining = threads.filter((t) => t.id !== id)
        if (remaining.length > 0) {
          setActiveId(remaining[0].id)
        } else {
          const fresh = await api.createThread()
          setThreads([fresh])
          setActiveId(fresh.id)
        }
      }
    },
    [activeId, threads, setActiveId],
  )

  return {
    threads,
    activeId,
    loading,
    setActiveId,
    createThread,
    renameThread,
    deleteThread,
    refresh,
  }
}

export type ThreadsState = ReturnType<typeof useThreads>
