"""Smoke test for the generator — issues one real Claude call."""
import os

import pytest


@pytest.fixture(scope="module")
def generator():
    from dotenv import load_dotenv
    load_dotenv()
    if not os.environ.get("ANTHROPIC_API_KEY"):
        pytest.skip("ANTHROPIC_API_KEY not set")
    from src.generate import Generator
    return Generator()


def test_generator_returns_answer_with_citations(generator):
    chunks = [
        {"chunk_id": "AAPL_1A_0", "ticker": "AAPL", "item": "1A",
         "text": "Apple depends on a concentrated set of component suppliers in Asia, "
                 "exposing the company to geopolitical and supply chain risks."},
        {"chunk_id": "AAPL_1A_1", "ticker": "AAPL", "item": "1A",
         "text": "Manufacturing disruptions from natural disasters or pandemics have "
                 "historically affected Apple's ability to meet product demand."},
    ]
    result = generator.generate("What are Apple's main supply chain risks?", chunks)
    assert "answer" in result
    assert "citations" in result
    assert "chunks_used" in result
    assert len(result["answer"]) > 30
    # The prompt instructs inline [chunk_id] citations; at least one should appear.
    assert len(result["citations"]) >= 1
    # Citations should be drawn from the supplied chunk_ids.
    assert all(cid in {"AAPL_1A_0", "AAPL_1A_1"} for cid in result["citations"])
