import { useEffect, useState } from "react"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import type { ChunkFull } from "@/lib/types"

interface ChunkSheetProps {
  chunkId: string | null
  onClose: () => void
}

export function ChunkSheet({ chunkId, onClose }: ChunkSheetProps) {
  const [chunk, setChunk] = useState<ChunkFull | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!chunkId) {
      setChunk(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setChunk(null)
    api
      .getChunk(chunkId)
      .then((c) => {
        if (!cancelled) setChunk(c)
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
  }, [chunkId])

  const open = chunkId !== null

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">
            {chunkId ?? "—"}
          </SheetTitle>
          {chunk && (
            <SheetDescription className="font-mono text-xs">
              {chunk.ticker} · Item {chunk.item}
              {chunk.section_title && ` · ${chunk.section_title}`} ·{" "}
              {chunk.char_count.toLocaleString()} chars
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="mt-6">
          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive">
              Failed to load chunk: {error}
            </p>
          )}
          {chunk && (
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">
              {chunk.text}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
