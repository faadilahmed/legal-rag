import { MessagesSquare, FolderOpen } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ThreadList } from "@/components/threads/ThreadList"
import { DocumentBrowser } from "@/components/corpus/DocumentBrowser"
import type { ThreadsState } from "@/hooks/useThreads"

interface LeftSidebarProps {
  threadsState: ThreadsState
}

export function LeftSidebar({ threadsState }: LeftSidebarProps) {
  const { threads, activeId, loading, setActiveId, createThread, renameThread, deleteThread } =
    threadsState

  return (
    <Tabs defaultValue="chats" className="flex h-full flex-col">
      <TabsList className="m-2 grid grid-cols-2">
        <TabsTrigger value="chats" className="gap-2">
          <MessagesSquare className="h-4 w-4" />
          Chats
        </TabsTrigger>
        <TabsTrigger value="documents" className="gap-2">
          <FolderOpen className="h-4 w-4" />
          Documents
        </TabsTrigger>
      </TabsList>
      <TabsContent value="chats" className="m-0 flex-1 overflow-hidden pt-2">
        <ThreadList
          activeId={activeId}
          threads={threads}
          loading={loading}
          onSelect={setActiveId}
          onCreate={createThread}
          onRename={renameThread}
          onDelete={deleteThread}
        />
      </TabsContent>
      <TabsContent value="documents" className="m-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <DocumentBrowser />
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
