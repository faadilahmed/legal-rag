import { AssistantRuntimeProvider } from "@assistant-ui/react"

import { AppShell } from "@/components/layout/AppShell"
import { Thread } from "@/components/chat/Thread"
import { useLegalRagRuntime } from "@/runtime/LegalRagRuntime"
import { useThreads } from "@/hooks/useThreads"

export default function App() {
  const threadsState = useThreads()
  const { runtime, hydrated } = useLegalRagRuntime(
    threadsState.activeId,
    threadsState.createThread,
  )

  return (
    // key={activeId} forces a full remount of the runtime when the selected
    // thread changes. This is simpler than a "switch thread" API on the runtime
    // and is fast enough in practice (<200 ms typical load).
    <AssistantRuntimeProvider runtime={runtime} key={threadsState.activeId ?? "null"}>
      <AppShell threadsState={threadsState}>
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
