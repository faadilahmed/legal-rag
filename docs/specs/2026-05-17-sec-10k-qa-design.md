# SEC 10-K Q&A — Design Decisions Addendum

**Date:** 2026-05-17
**Canonical spec:** [`SEC_10K_QA_Project_Spec.md`](../../../SEC_10K_QA_Project_Spec.md) in the repo root.
**Purpose:** The canonical spec is comprehensive — it covers architecture, every stage's code, dependencies, the execution plan, and the README structure. This addendum records only the local decisions made on top of the spec during the 2026-05-17 brainstorming session, plus a couple of small spec corrections we apply during implementation. Read the canonical spec first; this is the diff.

---

## 1. Decisions made on top of the spec

### 1.1 Project root

- **Location:** `/Users/faadilahmed/Code/iManage Project/legal-rag/`
- The canonical spec specifies a `legal-rag/` directory; we keep that and place it as a subdirectory inside the existing working directory. The spec file remains at the working-directory level alongside `legal-rag/` and `docs/`.

### 1.2 Python environment

- **Python version:** 3.12, managed by `uv` (`uv python install 3.12`).
- **Venv:** `legal-rag/.venv`, created via `uv venv`.
- **Dependency install:** `uv pip install -r requirements.txt` (faster, deterministic resolver) — same `requirements.txt` content as the spec.
- **Rationale:** System Python is 3.9.6, too old for some of the stack defaults. `uv` is already on the user's path; Anaconda 3.12 also exists but we prefer an isolated, uv-managed interpreter so this project doesn't depend on the user's anaconda installation.

### 1.3 Evaluation queries (the 30 hand-labeled set)

- **Owner:** User hand-labels all 30 queries himself.
- **What I deliver:** `data/eval/eval_queries.json` as a stub with the exact JSON schema from the spec, populated with one fully-worked example, and a separate brief (`data/eval/HOW_TO_LABEL.md` — kept short, ≤30 lines) describing the labeling guidance the spec describes: sectors, query types (factual / comparative / evolution), difficulty mix.
- **Rationale:** The canonical spec explicitly calls this out as "don't shortcut this — hand-label yourself." It's the highest-credibility interview signal; me ghost-writing it against my own retrieval system would invalidate the eval.

### 1.4 Deployment target

- **What ships:** Working local install + GitHub repo with the code.
- **What does NOT ship initially:** Hugging Face Spaces deploy.
- **README diff:** The "🚀 Live Demo" line in the README template is replaced with a "Run locally" subsection (the spec's existing `Setup` section already covers this). The HF Spaces deploy can be added later if desired — none of the implementation depends on it.

### 1.5 Git / GitHub setup

- **Local init:** `git init` inside `legal-rag/` on day one. Incremental commits per stage, per the spec's "Critical reminders" note about meaningful git log.
- **GitHub creation:** User creates the GitHub repo via the web UI when ready, then runs the printed `git remote add origin <url> && git push -u origin main`. `gh` CLI is not installed and we are not installing it as a side quest.
- **First commit:** Repo scaffold (directory structure, `.gitignore`, `pyproject.toml`, `requirements.txt`, empty `__init__.py`, `.env.example`, `README.md` skeleton). Subsequent commits land one stage at a time.

### 1.6 SEC EDGAR User-Agent

- **Value:** `"Faadil Ahmed faadil.ahmed2@gmail.com"` baked into `src/config.py` as `SEC_USER_AGENT`. The user accepted that this email will be visible in the public repo.

### 1.7 Anthropic API key

- **Storage:** `legal-rag/.env` (gitignored from the first commit). Loaded via `python-dotenv` in any module that touches the Anthropic client.
- **Source:** User pastes the key in chat; I write it to `.env` and never to the tracked tree.
- **`.env.example`:** Committed with `ANTHROPIC_API_KEY=` (empty value) so the template is visible in the repo.

---

## 2. Small corrections we'll apply during implementation

These are minor things in the spec that I'll quietly fix as I go — recording them here so it's traceable rather than hidden:

- **`ingest.py` user-agent parsing bug:** The spec parses `SEC_USER_AGENT` with `name, email = SEC_USER_AGENT.split(" ", 1)`. For a value like `"Faadil Ahmed faadil.ahmed2@gmail.com"`, this yields `name="Faadil"` and `email="Ahmed faadil.ahmed2@gmail.com"`, which `sec-edgar-downloader` will reject because the email isn't a valid address. We'll fix this by splitting on the *last* space (`rsplit(" ", 1)`) so `name="Faadil Ahmed"` and `email="faadil.ahmed2@gmail.com"`.
- **Filing glob in `scripts/build_index.py`:** The spec uses `RAW_DIR.glob("**/10-K/**/*.txt") + RAW_DIR.glob("**/10-K/**/*.htm")`. `sec-edgar-downloader` typically stores filings as `full-submission.txt` (a multi-document SGML container) plus extracted exhibits. We'll filter to the primary `full-submission.txt` only to avoid double-processing exhibits, and add a fallback for `.htm` if newer downloader versions change layout. The preprocessing layer needs to handle the SGML wrapper — `html_to_text()` may need a small pre-step that extracts the `<DOCUMENT>` block with `<TYPE>10-K` (the first one in the submission) before handing HTML to BeautifulSoup, otherwise exhibits like EX-31/EX-32 get mixed in.
- **`preprocess_filing` ticker extraction:** The spec's `filing_path.parts[-4]` assumes a specific path depth. We'll make this resilient by walking up the path until we find a directory matching a known ticker (or by passing the ticker in alongside the path).
- **`__init__.py` for `src/`:** Spec lists `src/__init__.py` but doesn't show its contents. We leave it empty (package marker only).
- **Python type-hint syntax:** Spec uses `list[dict]`/`dict | None`-style hints. Python 3.12 supports them natively, so we keep the spec's style as-is. (Was a concern when the env was undecided; resolved now that we're on 3.12.)
- **`generate.py` regex `[\w_]+`:** Redundant — `\w` already includes underscore. Leave as-is (matches the spec verbatim); not worth a deviation.
- **`preprocess.py` section dedup:** The spec's "keep last 15 sections" heuristic drops Items 1-7 on real 10-Ks because total match count (TOC + content + cross-references) exceeds 30. Replaced with: for each unique item number, keep the match with the longest text span (TOC entries span ~50 chars; content sections span thousands). An additional title-score filter deprioritises cross-reference fragments (those whose captured title starts with a lowercase letter, punctuation, or connector word like "of"/"in"/"under") over real section headings. Verified on AAPL and MSFT — Item 1A now correctly captured. Note: AAPL's Item 1A is only ~790 chars because this filing incorporates Risk Factors by reference to the Annual Report rather than reproducing them; this is correct for that filing structure.

---

## 3. What we are explicitly NOT changing from the spec

For clarity, none of the following are up for revisiting during implementation — they're decisions the canonical spec already made and we treat them as fixed:

- The architecture (hybrid FAISS + BM25 with RRF, cross-encoder reranking, Claude generation with inline citations).
- The model choices: `all-MiniLM-L6-v2` for embedding, `ms-marco-MiniLM-L-6-v2` for reranking, `claude-opus-4-7` for generation.
- The chunking strategy (recursive, 800/100).
- The ticker list (~80 tickers across 10 sectors).
- The directory structure under `legal-rag/`.
- The PySpark module as a required deliverable (it's a key interview signal per the canonical spec's reminders).
- The README structure, including the "What I'd do at scale" section.

---

## 4. Execution model

Once this design is approved, the next step is to invoke `superpowers:writing-plans` to produce a detailed implementation plan that decomposes the spec's 11 stages into discrete, independently-executable, verifiable tasks. The implementation plan — not this addendum — is what the executing-plans / subagent-driven-development skill will work from.

The canonical spec's "Weekend execution plan" (Saturday morning → Sunday afternoon) is the right shape; the implementation plan will preserve that ordering and add explicit verification steps per stage (smoke tests, expected outputs, manual checkpoints with the user where appropriate — e.g., before kicking off the SEC EDGAR download, before running the full embedding pass, before deploying).
