import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import type { Thread } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ThreadListItemProps {
  thread: Thread
  active: boolean
  onSelect: () => void
  onRename: (newTitle: string) => Promise<void>
  onDelete: () => Promise<void>
}

export function ThreadListItem({
  thread,
  active,
  onSelect,
  onRename,
  onDelete,
}: ThreadListItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(thread.title)

  const commit = async () => {
    const next = draft.trim()
    if (next && next !== thread.title) {
      await onRename(next)
    } else {
      setDraft(thread.title)
    }
    setEditing(false)
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
        active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      )}
    >
      {editing ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") void commit()
            if (e.key === "Escape") {
              setDraft(thread.title)
              setEditing(false)
            }
          }}
          className="h-7 flex-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 truncate text-left"
          title={thread.title}
        >
          {thread.title}
        </button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => void onDelete()}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
