import type { ChunkFull, ChunkPreview, CorpusTree, Thread, Trace } from "./types"

// Resolve fetch URLs against this base. Empty string keeps the existing
// relative-path behavior (works with Vite's dev proxy and with same-origin
// hosting). In production on Azure Static Web Apps + Container Apps the
// build sets this to the ACA backend URL so calls hit the right origin.
const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "")
const u = (path: string): string => `${API_BASE}${path}`

export interface SourceChunkRow {
  chunk_id: string
  ticker: string
  item: string
  section_title: string
  rerank_score: number
  retrieval_score: number
  text_preview: string
}

export interface MessageRow {
  id: string
  role: "user" | "assistant"
  content: string
  sources: { chunks: SourceChunkRow[] } | null
  created_at: number
  seq: number
}

async function jsonOrThrow<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let body = ""
    try {
      body = await r.text()
    } catch {
      // ignore
    }
    throw new Error(`API ${r.status} ${r.statusText}: ${body.slice(0, 200)}`)
  }
  return (await r.json()) as T
}

export const api = {
  async createThread(title?: string): Promise<Thread> {
    const r = await fetch(u("/api/threads"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return jsonOrThrow<Thread>(r)
  },

  async getChunk(chunkId: string): Promise<ChunkFull> {
    const r = await fetch(u(`/api/chunks/${encodeURIComponent(chunkId)}`))
    return jsonOrThrow<ChunkFull>(r)
  },

  async getMessages(threadId: string): Promise<MessageRow[]> {
    const r = await fetch(
      u(`/api/threads/${encodeURIComponent(threadId)}/messages`),
    )
    const body = await jsonOrThrow<{ messages: MessageRow[] }>(r)
    return body.messages
  },

  async listThreads(): Promise<Thread[]> {
    const r = await fetch(u("/api/threads"))
    const body = await jsonOrThrow<{ threads: Thread[] }>(r)
    return body.threads
  },

  async renameThread(id: string, title: string): Promise<Thread> {
    const r = await fetch(u(`/api/threads/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return jsonOrThrow<Thread>(r)
  },

  async deleteThread(id: string): Promise<void> {
    const r = await fetch(u(`/api/threads/${encodeURIComponent(id)}`), {
      method: "DELETE",
    })
    await jsonOrThrow<{ deleted: boolean }>(r)
  },

  async archiveThread(id: string, archived: boolean): Promise<Thread> {
    const r = await fetch(u(`/api/threads/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    })
    return jsonOrThrow<Thread>(r)
  },

  async getCorpus(): Promise<CorpusTree> {
    const r = await fetch(u("/api/corpus"))
    return jsonOrThrow<CorpusTree>(r)
  },

  async listChunks(
    ticker: string,
    item: string,
    year?: number | null,
    limit = 200,
    offset = 0,
  ): Promise<{ items: ChunkPreview[]; total: number }> {
    const params = new URLSearchParams({
      ticker,
      item,
      limit: String(limit),
      offset: String(offset),
    })
    if (year) params.set("year", String(year))
    const r = await fetch(u(`/api/chunks?${params}`))
    return jsonOrThrow<{ items: ChunkPreview[]; total: number }>(r)
  },

  async getMessageTrace(threadId: string, messageId: string): Promise<Trace> {
    const r = await fetch(
      u(`/api/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}/trace`),
    )
    return jsonOrThrow<Trace>(r)
  },
}
