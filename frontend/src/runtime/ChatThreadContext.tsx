import { createContext, useContext, useMemo } from "react"
import type { ReactNode } from "react"

interface ChatThreadContextValue {
  activeThreadId: string | null
}

const ChatThreadContext = createContext<ChatThreadContextValue | null>(null)

export function ChatThreadProvider({
  activeThreadId,
  children,
}: {
  activeThreadId: string | null
  children: ReactNode
}) {
  const value = useMemo(() => ({ activeThreadId }), [activeThreadId])
  return (
    <ChatThreadContext.Provider value={value}>
      {children}
    </ChatThreadContext.Provider>
  )
}

export function useChatThread(): ChatThreadContextValue {
  const v = useContext(ChatThreadContext)
  if (!v) throw new Error("useChatThread must be used inside ChatThreadProvider")
  return v
}
