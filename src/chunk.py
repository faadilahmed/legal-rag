"""Stage 3: Split sections into retrievable chunks via recursive splitting on
natural boundaries (\\n\\n > \\n > '. ' > ' ' > '')."""
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import CHUNK_OVERLAP, CHUNK_SIZE


def chunk_document(doc: dict) -> list[dict]:
    """Chunk a preprocessed document into retrieval units carrying full lineage.

    Each returned chunk dict has: chunk_id, ticker, year, item, section_title, text, char_count.

    chunk_id format is `{ticker}_{year}_{item}_{i}` when a year is present
    (multi-year corpus), or `{ticker}_{item}_{i}` when not (single-year, for
    backward compatibility with the test fixtures). Including the year is
    necessary once multiple filings per ticker land in the index — otherwise
    AAPL_1A_0 from FY2024 and FY2025 would collide.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    year = doc.get("year") or 0  # 0 = unknown, falls back to legacy id format
    year_seg = f"{year}_" if year else ""

    chunks: list[dict] = []
    for section in doc["sections"]:
        section_chunks = splitter.split_text(section["text"])
        for i, chunk_text in enumerate(section_chunks):
            chunks.append({
                "chunk_id": f"{doc['ticker']}_{year_seg}{section['item']}_{i}",
                "ticker": doc["ticker"],
                "year": year,
                "item": section["item"],
                "section_title": section["title"],
                "text": chunk_text,
                "char_count": len(chunk_text),
            })
    return chunks
