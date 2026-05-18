import { useState } from "react"
import { Microscope } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useChatThread } from "@/runtime/ChatThreadContext"

import { TracePanel } from "./TracePanel"

interface TraceButtonProps {
  messageId: string | null
}

export function TraceButton({ messageId }: TraceButtonProps) {
  const [open, setOpen] = useState(false)
  const { activeThreadId } = useChatThread()
  if (!messageId || !activeThreadId) return null
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="View trace — see exactly what produced this answer"
        aria-label="View trace"
      >
        <Microscope className="h-3.5 w-3.5" />
      </Button>
      <TracePanel
        open={open}
        onOpenChange={setOpen}
        threadId={activeThreadId}
        messageId={messageId}
      />
    </>
  )
}
