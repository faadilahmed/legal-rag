import { useLocalRuntime, type ChatModelAdapter } from "@assistant-ui/react"

/**
 * STUB runtime. Yields a canned response one character at a time after a brief
 * delay, so we can visually verify that assistant-ui's typing animation works.
 * Phase D1 replaces this with a real fetch to /api/chat/stream.
 *
 * NOTE: ChatModelAdapter.run in @assistant-ui/react 0.14.x yields
 * ChatModelRunResult (same shape as ChatModelRunUpdate in older docs).
 */
const stubAdapter: ChatModelAdapter = {
  async *run({ abortSignal }) {
    const cannedResponse =
      "Stub response — assistant-ui is wired correctly. The real streaming runtime lands in Phase D1."
    let acc = ""
    for (const ch of cannedResponse) {
      if (abortSignal.aborted) return
      await new Promise((resolve) => setTimeout(resolve, 25))
      acc += ch
      yield { content: [{ type: "text", text: acc }] }
    }
  },
}

export function useLegalRagRuntime() {
  return useLocalRuntime(stubAdapter)
}
