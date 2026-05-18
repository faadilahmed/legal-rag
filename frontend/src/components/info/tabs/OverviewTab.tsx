export function OverviewTab() {
  return (
    <div className="prose prose-sm prose-invert max-w-none space-y-4">
      <section>
        <h3 className="!mt-0 !mb-2">What this is</h3>
        <p className="!mt-0 text-muted-foreground">
          A hybrid-retrieval RAG system over <strong>387 SEC 10-K filings</strong> (5 most-recent years from 76 large-cap US companies across 10 sectors, <strong>264,449 chunks</strong> total, <strong>47,640 in Item 1A Risk Factors</strong>). You ask a question; the system auto-scopes by company name if you mention one, runs hybrid dense+sparse retrieval with per-Item bias, reranks the top candidates with a cross-encoder, and Claude generates a citation-grounded answer streamed token-by-token.
        </p>
        <p className="text-muted-foreground">
          Built as a portfolio piece to demonstrate the architectural pattern of governed semantic search over a corpus of business / legal documents with traceable citations — the same shape as what iManage's MCP server enables for legal documents.
        </p>
      </section>

      <section>
        <h3 className="!mb-2">Query path (per turn)</h3>
        <ol className="!mt-0 text-muted-foreground">
          <li>Frontend POSTs to <code className="text-foreground">/api/chat/stream</code> with the question, prior conversation, and any active ticker/year scope.</li>
          <li>Backend persists the user message, loads prior history, and embeds the query into a 384-dim L2-normalized vector.</li>
          <li><strong>Auto-scope:</strong> if the query names companies (&ldquo;JPMorgan and Goldman Sachs&hellip;&rdquo;), detect the tickers and apply as a retrieval filter.</li>
          <li><strong>Hybrid retrieval:</strong> FAISS dense top-50 + BM25 sparse top-50, fused with Reciprocal Rank Fusion (K=60). Per-Item bias nudges substantive sections (Item 1A / 7 / 7A) above procedural ones. For risk-flavored queries, oversample 3× to 150 candidates.</li>
          <li><strong>Cross-encoder rerank:</strong> score (query, chunk) pairs jointly. Each chunk's text is prepended with &ldquo;TICKER YEAR 10-K Item X: &rdquo; first so the reranker sees company context even when the body says &ldquo;the Company&rdquo;. For multi-company scoped queries, apply a per-ticker quota so no one company starves the others.</li>
          <li>Top-8 reranked chunks are emitted as a sources SSE frame — UI mounts the source panel before text streams.</li>
          <li>Claude generates with the chat-aware system prompt + corpus metadata + multi-turn history + the 8 chunks. Tokens stream as SSE text deltas (0: frames).</li>
          <li>Assistant message + sources + the full per-turn trace (50–80 KB of retrieval-stage breakdowns) persist to SQLite. A metadata frame surfaces the new message id; a follow-ups frame emits 3 suggested next questions.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Total end-to-end latency: typically <strong>3–5 seconds</strong> (Claude generation dominates; embed + retrieve + rerank combined is sub-500 ms).
        </p>
      </section>

      <section>
        <h3 className="!mb-2">Try the Trace inspector</h3>
        <p className="!mt-0 text-muted-foreground">
          On every assistant message there's a small microscope icon next to the avatar. Click it to see <strong>everything</strong> that produced that specific answer — all 50 retrieved chunks with their per-ranker scores (dense / sparse / RRF / rerank), the cross-encoder reordering, the exact system prompt sent to Claude, and per-stage latency.
        </p>
      </section>

      <section>
        <h3 className="!mb-2">What I&apos;d do at scale</h3>
        <p className="!mt-0 text-muted-foreground">
          At hundreds of millions of documents across thousands of customer organizations:
        </p>
        <ol className="text-muted-foreground">
          <li>
            <strong>Ingestion</strong> moves to a distributed batch pipeline (PySpark on Databricks) with medallion layering: <em>Bronze</em> for raw filings, <em>Silver</em> for cleaned / redacted text, <em>Gold</em> for embedded chunks with full lineage. The PySpark module in <code className="text-foreground">src/spark_embed.py</code> demonstrates the embedding-stage pattern at the smallest possible scale.
          </li>
          <li>
            <strong>Vector store</strong> becomes managed (Azure AI Search, Databricks Vector Search, pgvector, Pinecone, Weaviate). Critical capability beyond raw scale: <strong>permission-aware filtering at the index level</strong>. Each chunk carries access metadata (customer org, matter, document permissions); the retriever only surfaces chunks the asking user is authorized to see. Pre-filter, not post-filter — otherwise you embed-and-rerank chunks the user can never read.
          </li>
          <li>
            <strong>Evaluation</strong> moves from one-shot to continuous per-tenant — running labeled-query sets against per-customer slices on a schedule, with drift detection on input query distributions and output confidence. When Recall@5 drops for a customer, page somebody.
          </li>
        </ol>
        <p className="text-muted-foreground">
          The retrieval architecture itself — hybrid dense + sparse with cross-encoder rerank — translates directly. <strong>The operational discipline is what scales.</strong>
        </p>
      </section>

      <section>
        <h3 className="!mb-2">Honest limitations</h3>
        <ul className="!mt-0 text-muted-foreground">
          <li>2 of 78 tickers (C, MS) failed section detection entirely because their 10-K SGML doesn&apos;t match the <code className="text-foreground">Item X</code> regex; the working corpus is 76 tickers.</li>
          <li>6 of those 76 tickers (GE, HON, MCD, TMO, USB, WFC) use non-standard 10-K layouts — either headers without the &ldquo;Item X.&rdquo; prefix, or the wrap-around pattern where the substantive content lives in the EX-13 Annual Report exhibit. Item 1A retrieval for these is limited until preprocess gets a per-pattern extractor.</li>
          <li>Single-vector dense embeddings — multi-vector models like ColBERT score higher but at 100×+ index size.</li>
          <li>Chunks are 800-char windows respecting natural boundaries; no semantic chunking. Empirically fine for 10-Ks.</li>
          <li>The 30-query eval set was drafted by Claude with knowledge of the system, then validated. See the Eval tab for the honest framing. The numbers there predate the corpus rebuild that more than doubled chunk count.</li>
          <li>Single-tenant, no auth, no per-customer scopes — by design for a portfolio demo.</li>
        </ul>
      </section>
    </div>
  )
}
