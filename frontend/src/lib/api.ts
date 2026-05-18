import type { ChunkFull, Thread } from "./types"

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
}
