import { useEffect, useState } from "react"

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

// Matches Tailwind's `md` breakpoint. Used to render exactly ONE chat tree
// at a time (desktop split OR mobile full-width) — rendering both even
// with `display:none` mounts two parallel runtimes that fight each other.
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 768px)").matches,
  )
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])
  return isDesktop
}

export function AppShell({ children, threadsState }: AppShellProps) {
  const isDesktop = useIsDesktop()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // When the user picks a thread from the mobile sidebar, close it
  // automatically so they see the chat.
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
        onOpenSidebar={isDesktop ? undefined : () => setMobileSidebarOpen(true)}
      />

      {isDesktop ? (
        // Desktop: resizable sidebar + main panel
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
      ) : (
        // Mobile: chat full-width; sidebar in a left slide-in Sheet
        <>
          <main className="flex-1 overflow-y-auto">{children}</main>
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
              <div className="h-full overflow-y-auto pt-6">
                <LeftSidebar threadsState={mobileThreadsState} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      )}

      <InfoButton />
    </div>
  )
}
