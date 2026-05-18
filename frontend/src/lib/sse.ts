export type Frame =
  | { kind: "text"; text: string }
  | { kind: "data"; type: string; value: unknown }
  | { kind: "done"; finishReason: string; usage?: Record<string, number> }
  | { kind: "error"; message: string }

/**
 * Parse the assistant-ui Data Stream wire format. Each line is one frame:
 *   <code>:<json>\n
 * Codes used: 0 (text), 2 (data part), d (done), 3 (error).
 */
export async function* parseStream(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<Frame> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buf = ""

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl)
        buf = buf.slice(nl + 1)
        if (!line) continue
        const colon = line.indexOf(":")
        if (colon < 0) continue
        const code = line.slice(0, colon)
        const rest = line.slice(colon + 1)
        let payload: unknown
        try {
          payload = JSON.parse(rest)
        } catch {
          // Malformed frame — skip rather than abort the whole stream.
          continue
        }
        if (code === "0") {
          yield { kind: "text", text: payload as string }
        } else if (code === "2") {
          const p = payload as { type: string; value: unknown }
          yield { kind: "data", type: p.type, value: p.value }
        } else if (code === "d") {
          const p = payload as {
            finishReason: string
            usage?: Record<string, number>
          }
          yield { kind: "done", finishReason: p.finishReason, usage: p.usage }
        } else if (code === "3") {
          yield { kind: "error", message: payload as string }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
