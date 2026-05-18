import { MessagesSquare, FolderOpen } from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function LeftSidebar() {
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
      <TabsContent value="chats" className="m-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full px-2 pb-2">
          {/* ThreadList lands here in Phase E1 */}
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Your past conversations will appear here.
          </p>
        </ScrollArea>
      </TabsContent>
      <TabsContent value="documents" className="m-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full px-2 pb-2">
          {/* DocumentBrowser lands here in Phase E2 */}
          <p className="px-2 py-4 text-xs text-muted-foreground">
            The 76 indexed 10-K filings will appear here.
          </p>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  )
}
