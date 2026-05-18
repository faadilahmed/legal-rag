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
  year?: number | null
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

export interface CorpusItem {
  item: string
  chunk_count: number
}

export interface CorpusTicker {
  ticker: string
  chunk_count: number
  items: CorpusItem[]
}

export interface CorpusSector {
  name: string
  ticker_count: number
  chunk_count: number
  tickers: CorpusTicker[]
}

export interface CorpusTree {
  sectors: CorpusSector[]
}

export interface ChunkPreview {
  chunk_id: string
  ticker: string
  item: string
  section_title: string
  char_count: number
  preview: string
}
