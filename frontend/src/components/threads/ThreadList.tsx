import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Thread } from "@/lib/types"

import { ThreadListItem } from "./ThreadListItem"

interface ThreadListProps {
  activeId: string | null
  threads: Thread[]
  loading: boolean
  onSelect: (id: string) => void
  onCreate: () => Promise<unknown> | void
  onRename: (id: string, title: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function ThreadList({
  activeId,
  threads,
  loading,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ThreadListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-2 pb-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => void onCreate()}
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading && threads.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Loading conversations…
          </p>
        ) : threads.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            No conversations yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {threads.map((t) => (
              <ThreadListItem
                key={t.id}
                thread={t}
                active={t.id === activeId}
                onSelect={() => onSelect(t.id)}
                onRename={(title) => onRename(t.id, title)}
                onDelete={() => onDelete(t.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
