interface Row {
  name: string
  role: string
  notes: string
}

const FRONTEND: Row[] = [
  { name: "React 18 + Vite 5", role: "SPA frontend", notes: "No Next.js — single-page chat doesn't need SSR. Vite for fast HMR." },
  { name: "@assistant-ui/react 0.14", role: "Chat primitives", notes: "LocalRuntime + custom ChatModelAdapter consuming SSE; MessagePrimitive + ThreadPrimitive composition; data-part slots for sources / status / followups / metadata." },
  { name: "shadcn/ui + Radix", role: "Component primitives", notes: "Resizable, Tabs, Dialog, Sheet, Accordion, Tooltip, Checkbox, DropdownMenu — wired with Tailwind tokens." },
  { name: "Tailwind 3.4", role: "Styling", notes: "Dark mode by default; @tailwindcss/typography for prose; CSS variables for theme tokens." },
  { name: "Inter + JetBrains Mono", role: "Typography", notes: "Inter for body text with stylistic alternates (cv02/03/04/11); JetBrains Mono for citation pills, chunk IDs, monospaced data." },
  { name: "react-markdown + remark-gfm", role: "Markdown rendering", notes: "Renders Claude's bold/lists/tables; citation pills are post-processed into clickable buttons inside text nodes." },
  { name: "Sonner", role: "Toasts", notes: "Surface stream errors and abort events." },
]

const BACKEND: Row[] = [
  { name: "FastAPI", role: "HTTP server", notes: "Wraps the existing RAGPipeline. CORS to :5180 for Vite dev. Lifespan loads pipeline once + builds corpus tree." },
  { name: "aiosqlite + raw SQL", role: "Persistence", notes: "Two tables (threads + messages with trace_json column). No ORM — schema is too small to justify SQLAlchemy ceremony." },
  { name: "SSE (assistant-ui Data Stream)", role: "Streaming protocol", notes: "Line-prefixed frames: 0:text deltas / 2:typed data parts / d:done / 3:error. Wire format matches frontend parser exactly." },
  { name: "Anthropic SDK", role: "LLM client", notes: "messages.stream for token-by-token output. asyncio.to_thread wraps the sync follow-ups call to avoid blocking." },
  { name: "Python 3.12 + uv", role: "Runtime", notes: "Type hints throughout; uv for fast venv + dep install." },
]

const ML: Row[] = [
  { name: "sentence-transformers/all-MiniLM-L6-v2", role: "Bi-encoder (embed)", notes: "384-dim, ~80 MB, L2-normalized so cosine = dot product. Used at index build AND per query." },
  { name: "rank-bm25 BM25Okapi", role: "Sparse retrieval", notes: "Classic TF-IDF-style scoring. Catches exact-token matches (tickers, named entities, regulatory terms) that dense embeddings blur." },
  { name: "Reciprocal Rank Fusion (K=60)", role: "Hybrid fusion", notes: "Parameter-free. Each item gets 1/(K + rank + 1) from each ranker, summed. Works across incomparable score scales." },
  { name: "cross-encoder/ms-marco-MiniLM-L-6-v2", role: "Cross-encoder rerank", notes: "Scores (query, chunk) pairs jointly. One forward pass per pair — viable only on small candidate sets, which is why it runs after retrieval (top-50 → top-5)." },
  { name: "Claude Opus 4.7 (Anthropic)", role: "Generator", notes: "Citation-grounded chat with multi-turn context. Streams tokens. Follows the [chunk_id] inline-citation rule reliably." },
  { name: "FAISS IndexFlatIP", role: "Dense index", notes: "Inner-product on normalized vectors. Sub-millisecond search on 117k vectors in-memory." },
]

function Table({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium text-foreground">Component</th>
              <th className="px-3 py-2 font-medium text-foreground">Role</th>
              <th className="px-3 py-2 font-medium text-foreground">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.name} className="text-muted-foreground">
                <td className="px-3 py-2 align-top font-mono text-foreground">{r.name}</td>
                <td className="px-3 py-2 align-top">{r.role}</td>
                <td className="px-3 py-2 align-top">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StackTab() {
  return (
    <div className="space-y-6">
      <Table title="Frontend" rows={FRONTEND} />
      <Table title="Backend" rows={BACKEND} />
      <Table title="ML pipeline" rows={ML} />
    </div>
  )
}
