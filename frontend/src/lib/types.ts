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

export interface CorpusYear {
  year: number | null
  chunk_count: number
  items: CorpusItem[]
}

export interface CorpusTicker {
  ticker: string
  chunk_count: number
  years: CorpusYear[]
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
  year?: number | null
  item: string
  section_title: string
  char_count: number
  preview: string
}

export interface TraceCandidateChunk {
  chunk_id: string
  ticker: string
  year: number | null
  item: string
  section_title: string
  dense_score: number | null
  dense_rank: number | null
  sparse_score: number | null
  sparse_rank: number | null
  rrf_score: number | null
  rrf_rank: number | null
  rerank_score: number | null
  rerank_rank: number | null
  text_preview: string
}

export interface TraceRetrieval {
  n_chunks_in_index: number
  n_candidates_after_filter: number
  dense_top_k: number
  sparse_top_k: number
  candidates: TraceCandidateChunk[]
}

export interface TracePromptMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export interface TracePrompt {
  system: string
  messages: TracePromptMessage[]
}

export interface TraceTimingsMs {
  embed?: number
  retrieve?: number
  rerank?: number
  generate?: number
  followups?: number
}

export interface TraceUsage {
  prompt_tokens: number
  completion_tokens: number
}

export interface Trace {
  query: string
  query_embedding_preview: number[]
  filters: {
    ticker_filter: string[] | null
    year_filter: number[] | null
  }
  retrieval: TraceRetrieval
  rerank: { top_k: number }
  prompt: TracePrompt
  timings_ms: TraceTimingsMs
  usage: TraceUsage
}
