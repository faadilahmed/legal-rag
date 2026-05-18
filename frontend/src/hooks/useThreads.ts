import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { api } from "@/lib/api"
import type { Thread } from "@/lib/types"

const ACTIVE_KEY = "legal-rag.thread_id"

// A thread whose title is still the default placeholder counts as "empty".
// Once the user sends their first message, the backend auto-titles the
// thread (see backend/services/chat_service.py:_title_from), so the title
// stops matching "New chat" and the thread no longer counts toward the cap.
const EMPTY_TITLE = "New chat"
const MAX_EMPTY_THREADS = 3

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
    // Cap empty threads: if MAX_EMPTY_THREADS already exist with the
    // default "New chat" title, focus the most recent one instead of
    // spawning another. This is just a UX guard — once any of them
    // gets a user message, its title changes and it stops counting.
    const emptyThreads = threads.filter((t) => t.title === EMPTY_TITLE)
    if (emptyThreads.length >= MAX_EMPTY_THREADS) {
      const mostRecent = emptyThreads.reduce((a, b) =>
        b.created_at > a.created_at ? b : a,
      )
      setActiveId(mostRecent.id)
      toast.info(
        `You already have ${emptyThreads.length} empty chats. Ask a question in one before starting another.`,
      )
      return mostRecent
    }

    const t = await api.createThread()
    setThreads((prev) => [t, ...prev])
    setActiveId(t.id)
    return t
  }, [setActiveId, threads])

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
