import { AssistantRuntimeProvider } from "@assistant-ui/react"

import { AppShell } from "@/components/layout/AppShell"
import { Thread } from "@/components/chat/Thread"
import { useLegalRagRuntime } from "@/runtime/LegalRagRuntime"
import { useThreads } from "@/hooks/useThreads"
import { ScopeProvider } from "@/runtime/ScopeContext"

function ChatHost() {
  const threads = useThreads()
  const { runtime, hydrated } = useLegalRagRuntime(threads.activeId, threads.createThread)
  return (
    <AssistantRuntimeProvider runtime={runtime} key={threads.activeId ?? "null"}>
      <AppShell threadsState={threads}>
        {hydrated ? (
          <Thread />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Loading conversation…
            </p>
          </div>
        )}
      </AppShell>
    </AssistantRuntimeProvider>
  )
}

export default function App() {
  return (
    <ScopeProvider>
      <ChatHost />
    </ScopeProvider>
  )
}
