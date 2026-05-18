import { useState } from "react"

import { ChunkSheet } from "@/components/corpus/ChunkSheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useCorpus } from "@/hooks/useCorpus"

import { SectorNode } from "./SectorNode"

export function DocumentBrowser() {
  const { tree, loading, error } = useCorpus()
  const [openChunk, setOpenChunk] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="space-y-2 px-2 py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    )
  }
  if (error) {
    return (
      <p className="px-3 py-4 text-xs text-destructive">
        Failed to load corpus: {error}
      </p>
    )
  }
  if (!tree) return null

  return (
    <>
      <div className="space-y-1 px-2 pb-2">
        {tree.sectors.map((s) => (
          <SectorNode key={s.name} sector={s} onOpenChunk={setOpenChunk} />
        ))}
      </div>
      <ChunkSheet chunkId={openChunk} onClose={() => setOpenChunk(null)} />
    </>
  )
}
