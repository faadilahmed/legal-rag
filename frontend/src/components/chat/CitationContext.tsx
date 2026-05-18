import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

/**
 * Bridges citation pills (rendered inside MarkdownText) with source cards
 * (rendered inside SourcesPanel). Both are slotted into MessagePrimitive.Content
 * via the `components` prop and don't see each other's props directly — they
 * share state through this context provided at the AssistantMessage level.
 */
interface CitationContextValue {
  /** chunk_id currently being hovered in the answer text (highlights its source card) */
  hoveredChunkId: string | null
  /** Setter called by citation pills on mouseenter / mouseleave */
  setHoveredChunkId: (id: string | null) => void

  /** chunk_id whose ChunkSheet should currently be open. null = closed. */
  openChunkId: string | null
  /** Setter — called by citation-pill click and by source-card click */
  setOpenChunkId: (id: string | null) => void

  /** Source cards register their DOM node here so hover-on-citation can scroll them into view */
  registerCardRef: (chunkId: string, el: HTMLElement | null) => void

  /** Imperatively scroll the matching source card into view */
  scrollToCard: (chunkId: string) => void

  /** True when any citation activity has happened (hover or click), so SourcesPanel can auto-open */
  hasActivity: boolean
}

const CitationContext = createContext<CitationContextValue | null>(null)

export function CitationProvider({ children }: { children: React.ReactNode }) {
  const [hoveredChunkId, setHoveredChunkId] = useState<string | null>(null)
  const [openChunkId, setOpenChunkId] = useState<string | null>(null)
  const [hasActivity, setHasActivity] = useState(false)
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map())

  const registerCardRef = useCallback(
    (chunkId: string, el: HTMLElement | null) => {
      if (el) cardRefs.current.set(chunkId, el)
      else cardRefs.current.delete(chunkId)
    },
    [],
  )

  const scrollToCard = useCallback((chunkId: string) => {
    const el = cardRefs.current.get(chunkId)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [])

  const wrappedSetHovered = useCallback((id: string | null) => {
    setHoveredChunkId(id)
    if (id) setHasActivity(true)
  }, [])

  const wrappedSetOpen = useCallback((id: string | null) => {
    setOpenChunkId(id)
    if (id) setHasActivity(true)
  }, [])

  const value = useMemo<CitationContextValue>(
    () => ({
      hoveredChunkId,
      setHoveredChunkId: wrappedSetHovered,
      openChunkId,
      setOpenChunkId: wrappedSetOpen,
      registerCardRef,
      scrollToCard,
      hasActivity,
    }),
    [
      hoveredChunkId,
      openChunkId,
      hasActivity,
      registerCardRef,
      scrollToCard,
      wrappedSetHovered,
      wrappedSetOpen,
    ],
  )

  return (
    <CitationContext.Provider value={value}>
      {children}
    </CitationContext.Provider>
  )
}

/** Strict variant — throws if used outside a provider. */
export function useCitation(): CitationContextValue {
  const v = useContext(CitationContext)
  if (!v) throw new Error("useCitation must be used inside CitationProvider")
  return v
}

/** Optional variant — returns null outside a provider (used by user-message citation pills if any). */
export function useCitationOptional(): CitationContextValue | null {
  return useContext(CitationContext)
}
