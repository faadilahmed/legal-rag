import { AppShell } from "@/components/layout/AppShell"
import { Thread } from "@/components/chat/Thread"
import { RuntimeMount, useThreadHistory } from "@/runtime/LegalRagRuntime"
import { useThreads } from "@/hooks/useThreads"
import { ScopeProvider } from "@/runtime/ScopeContext"
import { Toaster } from "@/components/ui/sonner"

function ChatHost() {
  const threads = useThreads()
  // Load message history for the active thread BEFORE constructing the runtime
  // — useLocalRuntime seeds its message repository at construction time, so
  // it must be called with the populated initialMessages, not after.
  const initialMessages = useThreadHistory(threads.activeId)
  const hydrated = initialMessages !== null

  return (
    <AppShell threadsState={threads}>
      {hydrated ? (
        // Key ensures a clean runtime remount when the active thread changes.
        // We include the history length so seeding picks up after a new turn
        // completes on the current thread (refetched by useThreads.refresh).
        <RuntimeMount
          key={`${threads.activeId ?? "null"}:${initialMessages.length}`}
          activeThreadId={threads.activeId}
          initialMessages={initialMessages}
          onCreateThread={threads.createThread}
        >
          <Thread />
        </RuntimeMount>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        </div>
      )}
    </AppShell>
  )
}

export default function App() {
  return (
    <ScopeProvider>
      <ChatHost />
      <Toaster />
    </ScopeProvider>
  )
}
