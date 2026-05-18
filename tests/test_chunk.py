"""Tests for chunk.py — deterministic chunking logic."""
from src.chunk import chunk_document


def _make_doc(sections):
    return {"ticker": "TEST", "sections": sections}


def test_chunks_have_required_metadata():
    doc = _make_doc([
        {"item": "1A", "title": "Risk Factors", "text": "Risk text. " * 200},
    ])
    chunks = chunk_document(doc)
    assert len(chunks) > 1
    for c in chunks:
        assert c["ticker"] == "TEST"
        assert c["item"] == "1A"
        assert c["section_title"] == "Risk Factors"
        assert c["chunk_id"].startswith("TEST_1A_")
        assert c["char_count"] == len(c["text"])
        assert len(c["text"]) > 0


def test_chunk_ids_are_unique_within_section():
    doc = _make_doc([
        {"item": "1A", "title": "Risk Factors", "text": "Risk text. " * 200},
    ])
    chunks = chunk_document(doc)
    ids = [c["chunk_id"] for c in chunks]
    assert len(ids) == len(set(ids))


def test_chunks_respect_size_limit():
    from src.config import CHUNK_SIZE
    doc = _make_doc([
        {"item": "1", "title": "Business", "text": "Sentence one. " * 500},
    ])
    chunks = chunk_document(doc)
    # Recursive splitter may slightly exceed CHUNK_SIZE on rare boundary cases,
    # but every chunk should be within 2x of the target.
    for c in chunks:
        assert c["char_count"] <= CHUNK_SIZE * 2


def test_short_section_yields_single_chunk():
    doc = _make_doc([
        {"item": "1B", "title": "Unresolved Staff Comments", "text": "None."},
    ])
    chunks = chunk_document(doc)
    assert len(chunks) == 1
    assert chunks[0]["text"] == "None."


def test_chunks_from_multiple_sections_keep_section_identity():
    doc = _make_doc([
        {"item": "1", "title": "Business", "text": "Business text. " * 200},
        {"item": "1A", "title": "Risk Factors", "text": "Risk text. " * 200},
    ])
    chunks = chunk_document(doc)
    items = {c["item"] for c in chunks}
    assert items == {"1", "1A"}
