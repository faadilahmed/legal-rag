import { AssistantRuntimeProvider } from "@assistant-ui/react"

import { AppShell } from "@/components/layout/AppShell"
import { Thread } from "@/components/chat/Thread"
import { useLegalRagRuntime } from "@/runtime/LegalRagRuntime"

export default function App() {
  const { runtime, hydrated } = useLegalRagRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AppShell>
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
