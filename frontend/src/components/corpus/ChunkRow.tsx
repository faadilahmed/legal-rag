import type { ChunkPreview } from "@/lib/types"

interface ChunkRowProps {
  chunk: ChunkPreview
  onOpen: (chunkId: string) => void
}

export function ChunkRow({ chunk, onOpen }: ChunkRowProps) {
  return (
    <button
      type="button"
      onClick={() => onOpen(chunk.chunk_id)}
      className="block w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
    >
      <p className="font-mono text-[10px] text-muted-foreground">
        {chunk.chunk_id}
      </p>
      <p className="line-clamp-2 text-xs text-foreground">{chunk.preview}</p>
    </button>
  )
}
