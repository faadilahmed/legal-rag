import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { ThreadsState } from "@/hooks/useThreads"

import { InfoButton } from "@/components/info/InfoButton"

import { Header } from "./Header"
import { LeftSidebar } from "./LeftSidebar"

interface AppShellProps {
  children: React.ReactNode
  threadsState: ThreadsState
}

export function AppShell({ children, threadsState }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <Header threadsState={threadsState} />
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel
          defaultSize={22}
          minSize={15}
          maxSize={40}
          className="border-r border-border"
        >
          <LeftSidebar threadsState={threadsState} />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={78}>
          <div className="h-full overflow-y-auto">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
      <InfoButton />
    </div>
  )
}
