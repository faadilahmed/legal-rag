import { AssistantRuntimeProvider } from "@assistant-ui/react"

import { AppShell } from "@/components/layout/AppShell"
import { Thread } from "@/components/chat/Thread"
import { useLegalRagRuntime } from "@/runtime/LegalRagRuntime"

export default function App() {
  const runtime = useLegalRagRuntime()
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AppShell>
        <Thread />
      </AppShell>
    </AssistantRuntimeProvider>
  )
}
