import { useState } from "react"

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import type { ThreadsState } from "@/hooks/useThreads"

import { InfoButton } from "@/components/info/InfoButton"

import { Header } from "./Header"
import { LeftSidebar } from "./LeftSidebar"

interface AppShellProps {
  children: React.ReactNode
  threadsState: ThreadsState
}

export function AppShell({ children, threadsState }: AppShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // When the user picks a thread from the mobile sidebar, close it
  // automatically so they see the chat. Wrap the threadsState's setActiveId
  // with this side-effect, then pass through everything else unchanged.
  const mobileThreadsState: ThreadsState = {
    ...threadsState,
    setActiveId: (id: string) => {
      threadsState.setActiveId(id)
      setMobileSidebarOpen(false)
    },
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <Header
        threadsState={threadsState}
        onOpenSidebar={() => setMobileSidebarOpen(true)}
      />

      {/* Desktop layout: resizable split. Hidden on mobile (< md). */}
      <ResizablePanelGroup
        direction="horizontal"
        className="hidden flex-1 md:flex"
      >
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

      {/* Mobile layout: chat takes full width; sidebar lives in a slide-in
          Sheet triggered from the header's hamburger button. */}
      <main className="flex-1 overflow-y-auto md:hidden">{children}</main>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 md:hidden">
          <div className="h-full overflow-y-auto pt-6">
            <LeftSidebar threadsState={mobileThreadsState} />
          </div>
        </SheetContent>
      </Sheet>

      <InfoButton />
    </div>
  )
}
