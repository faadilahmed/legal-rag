import { useState } from "react"
import { ChevronRight, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { TracePrompt } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PromptViewerProps {
  prompt: TracePrompt
}

export function PromptViewer({ prompt }: PromptViewerProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium text-foreground">
        What Claude actually saw
      </h4>
      <CollapsibleBlock title="System prompt" content={prompt.system} />
      <CollapsibleBlock
        title={`Messages array (${prompt.messages.length})`}
        content={JSON.stringify(prompt.messages, null, 2)}
      />
    </div>
  )
}

function CollapsibleBlock({
  title,
  content,
}: {
  title: string
  content: string
}) {
  const [open, setOpen] = useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(content)
  }
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 px-2 py-1.5 text-xs hover:bg-accent"
        >
          <ChevronRight
            className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
          />
          <span className="font-medium">{title}</span>
          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
            {content.length.toLocaleString()} chars
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={copy}
          className="mr-1 h-6 w-6"
          aria-label="Copy"
          title="Copy to clipboard"
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
      {open && (
        <pre className="max-h-80 overflow-auto border-t border-border p-3 font-mono text-[10px] leading-relaxed text-foreground">
          {content}
        </pre>
      )}
    </div>
  )
}
