# SEC 10-K Q&A — Hybrid Retrieval with Citation-Grounded Generation

Portfolio project: semantic search + Q&A over ~80 SEC 10-K filings, demonstrating production-grade RAG architecture.

**Status:** Under construction. See `docs/specs/2026-05-17-sec-10k-qa-design.md` for the design and `docs/SEC_10K_QA_Project_Spec.md` for the canonical spec.

## Quick start

```bash
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
cp .env.example .env  # then add your ANTHROPIC_API_KEY

# Ingest + build the index (~20 minutes on a modern laptop)
python -m src.ingest
python scripts/build_index.py

# Evaluate
python scripts/run_eval.py

# Launch the UI
python app/gradio_app.py
```

(README will be expanded later with architecture diagram, eval results, and the "what I'd do at scale" section.)
