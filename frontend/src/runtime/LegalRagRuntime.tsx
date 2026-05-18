import { useEffect, useMemo, useState } from "react"

import {
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from "@assistant-ui/react"
import type { ThreadMessageLike } from "@assistant-ui/core"

import { api, type MessageRow } from "@/lib/api"
import { parseStream } from "@/lib/sse"
import type { Thread } from "@/lib/types"
import type { SourcesData } from "@/lib/types"

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

/**
 * useLegalRagRuntime
 *
 * @param activeThreadId  The thread ID currently selected in the sidebar.
 *                        Pass null if no thread is known yet (initial load).
 * @param onCreateThread  Callback that creates a new thread server-side and
 *                        updates the thread list / activeId in the parent store.
 *                        The runtime calls it lazily — only when the user
 *                        actually sends the first message.
 */
export function useLegalRagRuntime(
  activeThreadId: string | null,
  onCreateThread: () => Promise<Thread>,
): LegalRagRuntimeResult {
  const [threadId, setThreadId] = useState<string | null>(activeThreadId)
  const [initialMessages, setInitialMessages] = useState<
    readonly ThreadMessageLike[] | null
  >(null)

  // Whenever the active thread changes (sidebar click or first mount),
  // load its messages. We reset `initialMessages` to null so the runtime
  // re-renders in a loading state.
  useEffect(() => {
    let cancelled = false
    setInitialMessages(null)
    setThreadId(null)

    if (!activeThreadId) {
      // No thread yet — start with an empty list; the adapter will create one
      // lazily when the user sends the first message.
      setInitialMessages([])
      return
    }

    void (async () => {
      try {
        const rows = await api.getMessages(activeThreadId)
        if (cancelled) return
        setThreadId(activeThreadId)
        setInitialMessages(rows.map(dbRowToMessageLike))
      } catch {
        if (cancelled) return
        // Thread may have been deleted server-side — let the parent know.
        // We render an empty thread rather than crashing.
        setThreadId(activeThreadId)
        setInitialMessages([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeThreadId])

  // The adapter resolves the threadId lazily: if there is an activeThreadId
  // use it directly; otherwise call onCreateThread() to make one.
  const adapter = useMemo((): ChatModelAdapter => {
    return buildAdapter(async () => {
      if (threadId) return threadId
      const created = await onCreateThread()
      setThreadId(created.id)
      return created.id
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
