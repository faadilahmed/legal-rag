"""End-to-end pipeline smoke test against a tiny synthetic index."""
import os

import pytest


@pytest.fixture
def tiny_pipeline(tmp_path):
    from dotenv import load_dotenv
    load_dotenv()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")

    from src.embed import Embedder
    from src.generate import Generator
    from src.index import HybridIndex
    from src.pipeline import RAGPipeline
    from src.rerank import Reranker
    from src.retrieve import HybridRetriever

    chunks = [
        {"chunk_id": "AAPL_1A_0", "ticker": "AAPL", "item": "1A", "section_title": "Risk Factors",
         "text": "Apple depends on a concentrated set of component suppliers in Asia, "
                 "exposing the company to geopolitical and supply chain disruption risks.",
         "char_count": 165},
        {"chunk_id": "MSFT_1A_0", "ticker": "MSFT", "item": "1A", "section_title": "Risk Factors",
         "text": "Microsoft's cloud business faces competition from Amazon Web Services and "
                 "Google Cloud, and regulatory scrutiny may affect pricing.",
         "char_count": 145},
        {"chunk_id": "JPM_1A_0", "ticker": "JPM", "item": "1A", "section_title": "Risk Factors",
         "text": "JP Morgan is subject to extensive regulation of its capital, liquidity, "
                 "and risk management practices by multiple federal regulators.",
         "char_count": 150},
    ]
    embedder = Embedder()
    emb = embedder.embed_chunks([c["text"] for c in chunks])
    index = HybridIndex(emb, chunks)
    pipeline = RAGPipeline(
        embedder=embedder,
        index=index,
        retriever=HybridRetriever(index, embedder),
        reranker=Reranker(),
        generator=Generator(),
    )
    return pipeline


def test_pipeline_answers_apple_question(tiny_pipeline):
    result = tiny_pipeline.answer("What are Apple's main supply chain risks?")
    assert result["query"].startswith("What are Apple")
    assert len(result["answer"]) > 30
    assert "AAPL_1A_0" in result["citations"]
    assert any(c["chunk_id"] == "AAPL_1A_0" for c in result["chunks"])
