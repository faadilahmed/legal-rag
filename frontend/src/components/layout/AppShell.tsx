import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

import { Header } from "./Header"
import { LeftSidebar } from "./LeftSidebar"

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen flex-col bg-background text-foreground">
      <Header />
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel
          defaultSize={22}
          minSize={15}
          maxSize={40}
          className="border-r border-border"
        >
          <LeftSidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={78}>
          <div className="h-full overflow-y-auto">{children}</div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
