export interface Thread {
  id: string
  title: string
  created_at: number
  updated_at: number
  archived: boolean
}

export interface SourceChunk {
  chunk_id: string
  ticker: string
  item: string
  section_title: string
  rerank_score: number
  retrieval_score: number
  text_preview: string
}

export interface SourcesData {
  chunks: SourceChunk[]
}

export interface ChunkFull {
  chunk_id: string
  ticker: string
  item: string
  section_title: string
  text: string
  char_count: number
}
