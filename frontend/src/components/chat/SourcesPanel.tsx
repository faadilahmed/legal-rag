import { useEffect, useState } from "react"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ChunkSheet } from "@/components/corpus/ChunkSheet"
import { useCitationOptional } from "@/components/chat/CitationContext"
import type { SourceChunk } from "@/lib/types"

import { SourceCard } from "./SourceCard"

interface SourcesPanelProps {
  chunks: SourceChunk[]
}

export function SourcesPanel({ chunks }: SourcesPanelProps) {
  const cite = useCitationOptional()
  // Local fallback when not in a CitationProvider (defensive — should always
  // be wrapped when rendered from AssistantMessage).
  const [localOpenChunk, setLocalOpenChunk] = useState<string | null>(null)
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    undefined,
  )

  // When a citation is hovered or clicked anywhere in the answer, auto-open
  // the accordion so the matching source card is visible.
  useEffect(() => {
    if (cite?.hasActivity) setAccordionValue("sources")
  }, [cite?.hasActivity])

  const openChunkId = cite?.openChunkId ?? localOpenChunk
  const setOpenChunkId = cite?.setOpenChunkId ?? setLocalOpenChunk

  if (chunks.length === 0) return null

  return (
    <>
      <Accordion
        type="single"
        collapsible
        value={accordionValue}
        onValueChange={(v) => setAccordionValue(v || undefined)}
        className="mt-3 w-full"
      >
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
                  onOpen={setOpenChunkId}
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      <ChunkSheet
        chunkId={openChunkId}
        onClose={() => setOpenChunkId(null)}
      />
    </>
  )
}
