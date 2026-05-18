"""Stage 3: Split sections into retrievable chunks via recursive splitting on
natural boundaries (\\n\\n > \\n > '. ' > ' ' > '')."""
from langchain_text_splitters import RecursiveCharacterTextSplitter

from src.config import CHUNK_OVERLAP, CHUNK_SIZE


def chunk_document(doc: dict) -> list[dict]:
    """Chunk a preprocessed document into retrieval units carrying full lineage.

    Each returned chunk dict has: chunk_id, ticker, item, section_title, text, char_count.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    chunks: list[dict] = []
    for section in doc["sections"]:
        section_chunks = splitter.split_text(section["text"])
        for i, chunk_text in enumerate(section_chunks):
            chunks.append({
                "chunk_id": f"{doc['ticker']}_{section['item']}_{i}",
                "ticker": doc["ticker"],
                "item": section["item"],
                "section_title": section["title"],
                "text": chunk_text,
                "char_count": len(chunk_text),
            })
    return chunks
