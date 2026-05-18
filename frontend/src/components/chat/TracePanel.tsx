import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { Trace } from "@/lib/types"

import { PromptViewer } from "./trace/PromptViewer"
import { QueryEmbeddingViz } from "./trace/QueryEmbeddingViz"
import { RetrievedChunksList } from "./trace/RetrievedChunksList"
import { StatsStrip } from "./trace/StatsStrip"

interface TracePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  threadId: string | null
  messageId: string | null
}

export function TracePanel({
  open,
  onOpenChange,
  threadId,
  messageId,
}: TracePanelProps) {
  const [trace, setTrace] = useState<Trace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !threadId || !messageId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setTrace(null)
    api
      .getMessageTrace(threadId, messageId)
      .then((t) => {
        if (!cancelled) setTrace(t)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, threadId, messageId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Trace</SheetTitle>
          <SheetDescription className="font-mono text-xs">
            Everything that produced this answer.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          {loading && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading trace…</span>
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Couldn't load trace</p>
                <p className="text-xs">{error}</p>
              </div>
            </div>
          )}
          {trace && (
            <>
              <StatsStrip
                timings={trace.timings_ms}
                usage={trace.usage}
              />
              <QueryEmbeddingViz values={trace.query_embedding_preview} />
              <RetrievedChunksList
                candidates={trace.retrieval.candidates}
                topK={trace.rerank.top_k}
              />
              <PromptViewer prompt={trace.prompt} />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
