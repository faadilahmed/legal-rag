import { useEffect, useMemo, useState } from "react"

import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from "@assistant-ui/react"
import type { ThreadMessageLike } from "@assistant-ui/core"
import { toast } from "sonner"

import { api, type MessageRow } from "@/lib/api"
import { parseStream } from "@/lib/sse"
import type { Thread } from "@/lib/types"
import type { SourcesData } from "@/lib/types"
import { useScope } from "@/runtime/ScopeContext"
import { ChatThreadProvider } from "@/runtime/ChatThreadContext"

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
  const extraParts = row.sources
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

function buildAdapter(
  getThreadId: () => Promise<string>,
  getScopeTickers: () => ReadonlySet<string>,
  getScopeYears: () => ReadonlySet<number>,
): ChatModelAdapter {
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
      const scopeTickers = getScopeTickers()
      const scopeYears = getScopeYears()
      const tickerFilter =
        scopeTickers.size > 0 ? Array.from(scopeTickers) : null
      const yearFilter = scopeYears.size > 0 ? Array.from(scopeYears) : null

      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thread_id: threadId,
          message: { role: "user", content: userText },
          ticker_filter: tickerFilter,
          year_filter: yearFilter,
        }),
        signal: abortSignal,
      })
      if (!res.ok || !res.body) {
        throw new Error(`stream failed: ${res.status} ${res.statusText}`)
      }

      let acc = ""
      const dataParts: Array<{ type: string; name: string; data: unknown }> = []
      const REPLACE_NAMES = new Set(["status", "metadata"])

      const emit = (): ChatModelRunResult => ({
        content: [
          { type: "text", text: acc },
          ...dataParts,
        ] as unknown as ChatModelRunResult["content"],
      })

      const emitWithError = (message: string): ChatModelRunResult => ({
        content: [
          { type: "text", text: acc },
          ...dataParts,
          { type: "data", name: "error", data: { message } },
        ] as unknown as ChatModelRunResult["content"],
      })

      try {
        for await (const frame of parseStream(res.body)) {
          if (frame.kind === "text") {
            acc += frame.text
            yield emit()
          } else if (frame.kind === "data") {
            // 'status' and 'metadata' data parts REPLACE any previous part
            // with the same name — there should only ever be one of each
            // reflecting the current state. All other data part names append.
            if (REPLACE_NAMES.has(frame.type)) {
              const idx = dataParts.findIndex((p) => p.name === frame.type)
              const next = {
                type: "data",
                name: frame.type,
                data: frame.value,
              }
              if (idx >= 0) dataParts[idx] = next
              else dataParts.push(next)
            } else {
              dataParts.push({
                type: "data",
                name: frame.type,
                data: frame.value,
              })
            }
            yield emit()
          } else if (frame.kind === "done") {
            return
          } else if (frame.kind === "error") {
            throw new Error(frame.message)
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error("[LegalRagRuntime] stream error:", e)
        toast.error("Stream interrupted", { description: msg })
        yield emitWithError(msg)
        return
      }
    },
  }
}

/**
 * Load the message history for the given thread. Returns null while loading.
 * Reloads when activeThreadId changes.
 */
export function useThreadHistory(
  activeThreadId: string | null,
): readonly ThreadMessageLike[] | null {
  const [history, setHistory] = useState<readonly ThreadMessageLike[] | null>(
    null,
  )

  useEffect(() => {
    setHistory(null)

    if (!activeThreadId) {
      // No thread yet — render an empty thread; the adapter will create one
      // lazily when the user sends the first message.
      setHistory([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const rows = await api.getMessages(activeThreadId)
        if (cancelled) return
        setHistory(rows.map(dbRowToMessageLike))
      } catch (e) {
        if (cancelled) return
        console.error("[useThreadHistory] failed to load messages:", e)
        setHistory([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeThreadId])

  return history
}

/**
 * Mounts the assistant-ui runtime with the supplied initial messages and
 * provides it to children via AssistantRuntimeProvider.
 *
 * IMPORTANT: useLocalRuntime consumes `initialMessages` at hook-call time
 * (the message repository is seeded once during construction). This means
 * we must NOT call useLocalRuntime before initialMessages is ready —
 * otherwise the runtime is created empty and never picks up the messages
 * even when state updates with the loaded values.
 *
 * Parent wraps this in a key (typically activeThreadId + ':' + length-of-history)
 * so the component remounts cleanly when the thread changes.
 */
export function RuntimeMount({
  activeThreadId,
  initialMessages,
  onCreateThread,
  children,
}: {
  activeThreadId: string | null
  initialMessages: readonly ThreadMessageLike[]
  onCreateThread: () => Promise<Thread>
  children: React.ReactNode
}) {
  const [threadId, setThreadId] = useState<string | null>(activeThreadId)
  const scope = useScope()

  // Adapter must always read the latest threadId and scope, so we recreate it
  // when either changes. If the user starts on a "null" thread, the adapter
  // calls onCreateThread() the first time the user submits and then caches it.
  const adapter = useMemo(
    (): ChatModelAdapter =>
      buildAdapter(
        async () => {
          if (threadId) return threadId
          const created = await onCreateThread()
          setThreadId(created.id)
          return created.id
        },
        () => scope.tickers,
        () => scope.years,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [threadId, scope.tickers, scope.years],
  )

  const runtime = useLocalRuntime(adapter, { initialMessages })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatThreadProvider activeThreadId={activeThreadId}>
        {children}
      </ChatThreadProvider>
    </AssistantRuntimeProvider>
  )
}
