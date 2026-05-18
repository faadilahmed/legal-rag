import type { ChunkFull, Thread } from "./types"

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
    const r = await fetch("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return jsonOrThrow<Thread>(r)
  },

  async getChunk(chunkId: string): Promise<ChunkFull> {
    const r = await fetch(`/api/chunks/${encodeURIComponent(chunkId)}`)
    return jsonOrThrow<ChunkFull>(r)
  },

  async getMessages(threadId: string): Promise<MessageRow[]> {
    const r = await fetch(
      `/api/threads/${encodeURIComponent(threadId)}/messages`,
    )
    const body = await jsonOrThrow<{ messages: MessageRow[] }>(r)
    return body.messages
  },

  async listThreads(): Promise<Thread[]> {
    const r = await fetch("/api/threads")
    const body = await jsonOrThrow<{ threads: Thread[] }>(r)
    return body.threads
  },

  async renameThread(id: string, title: string): Promise<Thread> {
    const r = await fetch(`/api/threads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return jsonOrThrow<Thread>(r)
  },

  async deleteThread(id: string): Promise<void> {
    const r = await fetch(`/api/threads/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    await jsonOrThrow<{ deleted: boolean }>(r)
  },

  async archiveThread(id: string, archived: boolean): Promise<Thread> {
    const r = await fetch(`/api/threads/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    })
    return jsonOrThrow<Thread>(r)
  },
}
