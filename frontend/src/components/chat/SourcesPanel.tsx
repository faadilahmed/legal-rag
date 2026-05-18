import { useState } from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ChunkSheet } from "@/components/corpus/ChunkSheet"
import type { SourceChunk } from "@/lib/types"

import { SourceCard } from "./SourceCard"

interface SourcesPanelProps {
  chunks: SourceChunk[]
}

export function SourcesPanel({ chunks }: SourcesPanelProps) {
  const [openChunk, setOpenChunk] = useState<string | null>(null)
  if (chunks.length === 0) return null

  return (
    <>
      <Accordion type="single" collapsible className="mt-3 w-full">
        <AccordionItem value="sources" className="border-0">
          <AccordionTrigger className="text-xs text-muted-foreground hover:no-underline">
            Sources ({chunks.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 pt-2">
              {chunks.map((c) => (
                <SourceCard
                  key={c.chunk_id}
                  chunk={c}
                  onOpen={setOpenChunk}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <ChunkSheet chunkId={openChunk} onClose={() => setOpenChunk(null)} />
    </>
  )
}
