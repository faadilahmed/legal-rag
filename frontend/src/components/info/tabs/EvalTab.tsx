import { AlertTriangle, CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"

interface Miss {
  query: string
  expected: string
  actual: string
  diagnosis: string
}

const MISSES: Miss[] = [
  {
    query: "How do major US banks describe interest rate risk to net interest income?",
    expected: "BAC, JPM, USB, WFC",
    actual: "BA, AMZN, KMI, WMT, TMO",
    diagnosis: "Real retrieval failure. BM25 surfaced 'BA' (Boeing) on bigram overlap with 'interest rate' / 'income', ahead of the bank filings that use phrasing like 'NII sensitivity' or 'asset/liability mismatch'. The query never literally mentions a bank.",
  },
  {
    query: "Which technology companies cite AI as both an opportunity and a regulatory risk?",
    expected: "AAPL, AMZN, GOOGL, META, MSFT, NVDA",
    actual: "TMUS, ADBE, LLY, LOW, LLY",
    diagnosis: "The 'both X and Y' phrasing is hard for sparse retrieval. Needs query decomposition: split into 'AI as opportunity' and 'AI as regulatory risk' subqueries, then intersect.",
  },
  {
    query: "How do hyperscalers describe risks around AI compute infrastructure investments?",
    expected: "AAPL, AMZN, MSFT",
    actual: "GOOGL, TSLA, CVX, NVDA, GOOGL",
    diagnosis: "Partial label gap. GOOGL is reasonably a hyperscaler; my expected_tickers list omitted it. Counting as a 'miss' is harsh — the retrieval was substantively correct.",
  },
  {
    query: "What does Microsoft say about competition in its cloud business?",
    expected: "MSFT",
    actual: "ORCL (and others)",
    diagnosis: "Close-but-wrong-ticker. Embeddings picked up 'cloud competition' semantics more strongly from Oracle's framing than Microsoft's. A metadata-level ticker filter for company-specific queries would catch this.",
  },
  {
    query: "Which companies position themselves as beneficiaries of the energy transition?",
    expected: "NEE, FCX, NVDA, LIN",
    actual: "SLB, MPC, SLB, DUK, PSX",
    diagnosis: "Vague, sector-spanning query. The retriever surfaced energy-services and refiners (reasonable matches for 'energy transition' framing), just not the four tickers I picked.",
  },
]

export function EvalTab() {
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Retrieval metrics</h3>
        <p className="text-xs text-muted-foreground">
          Measured on 30 hand-labeled queries spanning 11 factual / 7 comparative / 12 aggregation queries across all 10 sectors (50 unique tickers referenced).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Recall@5
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">0.833</p>
            <p className="mt-1 text-xs text-muted-foreground">
              25 of 30 queries surface an expected-ticker chunk in the top 5
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              MRR
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">0.723</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Average first-relevant rank ≈ 1.4
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          The 5 misses, diagnosed
        </h3>
        <p className="text-xs text-muted-foreground">
          Transparency matters in eval. Each miss is categorized so the failure mode is legible (and so the next iteration knows where to focus).
        </p>
        <div className="space-y-2">
          {MISSES.map((m, i) => (
            <div
              key={i}
              className="rounded-md border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs font-medium text-foreground">
                  &ldquo;{m.query}&rdquo;
                </p>
              </div>
              <div className="space-y-1 pl-6 text-[11px] text-muted-foreground">
                <p>
                  <span className="font-mono">expected:</span>{" "}
                  <span className="font-mono text-foreground">{m.expected}</span>
                </p>
                <p>
                  <span className="font-mono">actual:</span>{" "}
                  <span className="font-mono text-foreground">{m.actual}</span>
                </p>
                <p className="pt-1 leading-relaxed">{m.diagnosis}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Eval-set provenance (honesty matters)
        </h3>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
          <p>
            The 30 queries were drafted by Claude <em>after the system was built</em>, grounded in publicly-known SEC 10-K disclosures, then validated against the index with per-miss diagnostics added.
          </p>
          <p className="mt-2">
            A truly independent eval would have a human author with no exposure to the retrieval implementation pick the questions. The current set is a starting point that surfaces real failure modes (see misses above) — but it&apos;s not blind. See <code className="text-foreground">data/eval/HOW_TO_LABEL.md</code> for the rubric to extend or replace it.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          RAGAS (faithfulness / answer_relevancy / context_precision)
        </h3>
        <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
          <Badge variant="secondary" className="shrink-0">
            pending
          </Badge>
          <p>
            The <code className="text-foreground">evaluate_generation_ragas</code> function is wired in <code className="text-foreground">src/evaluate.py</code>. It hasn&apos;t been run because RAGAS defaults to GPT-4 as judge and requires <code className="text-foreground">OPENAI_API_KEY</code>. Easy to enable; the harness is in place.
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          What the rerank step buys us
        </h3>
        <div className="flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p>
            On the single seed query (&ldquo;What are Apple&apos;s main supply chain risks?&rdquo;): raw retrieval (FAISS + BM25 + RRF) put Apple at <strong>rank 2</strong> (MRR=0.5). After the cross-encoder reranker, <code className="text-foreground">AAPL_1A_35</code> jumped to <strong>rank 1</strong> with rerank_score 3.93 (next-best: 1.07). Open the Trace inspector on any answer to see the full reranking deltas live.
          </p>
        </div>
      </section>
    </div>
  )
}
