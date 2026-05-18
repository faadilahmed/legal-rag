import { useEffect, useState } from "react"

import {
  useLocalRuntime,
  type ChatModelAdapter,
  type ChatModelRunResult,
} from "@assistant-ui/react"

import { api } from "@/lib/api"
import { parseStream } from "@/lib/sse"

const THREAD_ID_KEY = "legal-rag.thread_id"

async function ensureThreadId(): Promise<string> {
  const existing = window.localStorage.getItem(THREAD_ID_KEY)
  if (existing) return existing
  const created = await api.createThread()
  window.localStorage.setItem(THREAD_ID_KEY, created.id)
  return created.id
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

export function useLegalRagRuntime() {
  // Cache the thread_id promise so we don't recreate on every render.
  const [threadIdPromise] = useState<() => Promise<string>>(() => {
    let cached: Promise<string> | null = null
    return () => {
      if (!cached) cached = ensureThreadId()
      return cached
    }
  })

  // Touch the promise on mount so the thread is created eagerly.
  useEffect(() => {
    void threadIdPromise()
  }, [threadIdPromise])

  return useLocalRuntime(buildAdapter(threadIdPromise))
}
