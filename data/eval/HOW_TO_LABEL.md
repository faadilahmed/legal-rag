# How to label the 30 eval queries

The evaluation set is *yours to hand-label*. Drafted-by-LLM queries against the same corpus would invalidate the eval signal — interviewers will ask how the set was built, and "I wrote them myself" is the right answer.

## Schema (per query)

```json
{
  "query": "Plain-English question a financial analyst would ask",
  "expected_tickers": ["AAPL"],
  "expected_items": ["1A"],
  "expected_keywords": ["supply chain", "Asia"],
  "gold_answer": "1-2 sentence reference answer"
}
```

- `query`: Plain-English question a financial analyst would ask.
- `expected_tickers`: Tickers whose 10-K should be relevant.
- `expected_items`: Optional — Items where the answer lives (e.g., "1A" for Risk Factors).
- `expected_keywords`: Optional — terms a good answer should contain.
- `gold_answer`: 1-2 sentence reference answer.

## Coverage targets (30 queries total)

**By sector — at least 2 queries each (10 sectors × 2 = 20):**
- Tech, Finance, Healthcare, Energy, Consumer, Industrial, Telecom/Media, Real Estate, Utilities, Materials.

**By query type — at least 8 of each type:**
- **Factual:** "What does Pfizer disclose about pricing pressure?" → single-company, single-item.
- **Comparative:** "How do JPMorgan and Goldman describe trading risk differently?" → 2+ tickers.
- **Evolution:** "Which sectors most often cite AI as a risk?" → multi-company aggregation.

**By difficulty — at least 5 of each:**
- **Easy:** Answer in a single chunk, obvious section (Item 1A risk factors).
- **Medium:** Answer requires synthesizing 2-3 chunks across sections.
- **Hard:** Answer requires reasoning across companies or sections; ground truth may be partial.

## Process

1. Read 3-5 actual 10-K Item 1A sections to build intuition for the language.
2. Draft queries you're genuinely curious about — phrasing that mirrors how an analyst would ask.
3. For each, write `expected_tickers` from memory. Spot-check by running the query against the built index after T16 — if Recall@5 is 0, either the ticker is wrong or the query is unanswerable from the corpus.
4. Write `gold_answer` from the source text, lightly paraphrased. Quote sparingly.

The first entry (Apple supply chain) is left as a worked example. Replace or extend.
