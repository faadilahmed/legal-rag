import { useEffect, useMemo, useState } from "react"

import {
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from "@assistant-ui/react"
import type { ThreadMessageLike } from "@assistant-ui/core"

import { api, type MessageRow } from "@/lib/api"
import { parseStream } from "@/lib/sse"
import type { SourcesData } from "@/lib/types"

const THREAD_ID_KEY = "legal-rag.thread_id"

async function ensureThreadId(): Promise<string> {
  const existing = window.localStorage.getItem(THREAD_ID_KEY)
  if (existing) return existing
  const created = await api.createThread()
  window.localStorage.setItem(THREAD_ID_KEY, created.id)
  return created.id
}

/**
 * Convert a DB message row to the ThreadMessageLike shape that
 * useLocalRuntime's `initialMessages` option accepts.
 *
 * For assistant messages that have sources, we append a data part named
 * "sources" so the inline SourcesPanel restores correctly on refresh.
 */
function dbRowToMessageLike(row: MessageRow): ThreadMessageLike {
  if (row.role === "user") {
    return {
      id: row.id,
      role: "user",
      content: [{ type: "text", text: row.content }],
      createdAt: new Date(row.created_at),
    }
  }

  // Assistant message — build content array then freeze it as readonly.
  const textPart = { type: "text" as const, text: row.content }
  const extraParts =
    row.sources
      ? [
          {
            type: "data" as const,
            name: "sources",
            data: { chunks: row.sources.chunks } satisfies SourcesData,
          },
        ]
      : []

  return {
    id: row.id,
    role: "assistant" as const,
    content: [textPart, ...extraParts] as ThreadMessageLike["content"],
    createdAt: new Date(row.created_at),
    status: { type: "complete" as const, reason: "stop" as const },
  }
}

function buildAdapter(getThreadId: () => Promise<string>): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      const last = messages[messages.length - 1]
      if (!last || last.role !== "user") return
      // Pull plain text out of the user message parts.
      const userText = (last.content as Array<{ type: string; text?: string }>)
        .filter((p) => p.type === "text" && typeof p.text === "string")
        .map((p) => p.text as string)
        .join("")

      const threadId = await getThreadId()
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          message: { role: "user", content: userText },
          ticker_filter: null,
        }),
        signal: abortSignal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`stream failed: ${res.status} ${res.statusText}`)
      }

      let acc = ""
      const dataParts: Array<{ type: string; name: string; data: unknown }> = []

      const emit = (): ChatModelRunResult => ({
        content: [
          { type: "text", text: acc },
          ...dataParts,
        ] as unknown as ChatModelRunResult["content"],
      })

      for await (const frame of parseStream(res.body)) {
        if (frame.kind === "text") {
          acc += frame.text
          yield emit()
        } else if (frame.kind === "data") {
          dataParts.push({ type: "data", name: frame.type, data: frame.value })
          yield emit()
        } else if (frame.kind === "done") {
          // Final yield already captured everything; nothing to do.
          return
        } else if (frame.kind === "error") {
          throw new Error(frame.message)
        }
      }
    },
  }
}

export interface LegalRagRuntimeResult {
  runtime: ReturnType<typeof useLocalRuntime>
  hydrated: boolean
}

export function useLegalRagRuntime(): LegalRagRuntimeResult {
  const [threadId, setThreadId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<
    readonly ThreadMessageLike[] | null
  >(null)

  // On mount: resolve thread_id, fetch its prior messages, then set both.
  // We wait until we have messages (or an empty array on error) before
  // letting the runtime render, so history always appears on first paint.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const tid = await ensureThreadId()
        if (cancelled) return
        const rows = await api.getMessages(tid)
        if (cancelled) return
        setThreadId(tid)
        setInitialMessages(rows.map(dbRowToMessageLike))
      } catch {
        // Thread was deleted server-side or network error — reset and start fresh.
        window.localStorage.removeItem(THREAD_ID_KEY)
        try {
          const fresh = await ensureThreadId()
          if (!cancelled) {
            setThreadId(fresh)
            setInitialMessages([])
          }
        } catch {
          if (!cancelled) setInitialMessages([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const adapter = useMemo((): ChatModelAdapter => {
    if (!threadId) {
      // No-op adapter while we're still loading — won't be called because
      // we gate the Thread render on `hydrated`.
      return {
        async *run() {
          // nothing
        },
      }
    }
    return buildAdapter(() => Promise.resolve(threadId))
  }, [threadId])

  // useLocalRuntime must be called unconditionally (React rules).
  // Pass initialMessages once they're ready; the runtime uses them to seed
  // the message repository before the first render.
  const runtime = useLocalRuntime(
    adapter,
    initialMessages !== null ? { initialMessages } : undefined,
  )

  return {
    runtime,
    hydrated: initialMessages !== null,
  }
}
