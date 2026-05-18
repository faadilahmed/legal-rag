"""Stage 2: Convert raw 10-K SGML/HTML filings into clean text + detected sections.

sec-edgar-downloader writes each filing as 'full-submission.txt', an SGML wrapper
containing multiple <DOCUMENT> blocks (the 10-K plus exhibits). We extract the
first <DOCUMENT> of type 10-K, strip HTML, normalize unicode, then split into
'Item X.' sections.
"""
import re
import unicodedata
from pathlib import Path

from bs4 import BeautifulSoup

# Matches 'Item 1.' / 'Item 1A.' / 'Item 7A —' etc.
ITEM_PATTERN = re.compile(
    r"Item\s+(\d+[A-Z]?)\.?\s*[—\-–]?\s*([^\n]{1,100})",
    re.MULTILINE | re.IGNORECASE,
)

# Matches one <DOCUMENT>...</DOCUMENT> block in the SGML submission.
DOCUMENT_BLOCK = re.compile(
    r"<DOCUMENT>(.*?)</DOCUMENT>",
    re.DOTALL | re.IGNORECASE,
)

DOC_TYPE = re.compile(r"<TYPE>([^\n<]+)", re.IGNORECASE)
DOC_TEXT = re.compile(r"<TEXT>(.*?)</TEXT>", re.DOTALL | re.IGNORECASE)


def extract_10k_html(submission: str) -> str:
    """Return the HTML body of the 10-K document from a full-submission SGML file.

    Falls back to the entire submission if no <DOCUMENT> blocks are found
    (some older filings are plain HTML without the SGML wrapper).
    """
    blocks = DOCUMENT_BLOCK.findall(submission)
    if not blocks:
        return submission  # already plain HTML or text

    for block in blocks:
        type_match = DOC_TYPE.search(block)
        if type_match and type_match.group(1).strip().upper() == "10-K":
            text_match = DOC_TEXT.search(block)
            return text_match.group(1) if text_match else block

    # No 10-K block found — use the first block as a last resort
    text_match = DOC_TEXT.search(blocks[0])
    return text_match.group(1) if text_match else blocks[0]


def html_to_text(html: str) -> str:
    """Strip HTML, drop scripts/styles/tables, normalize unicode and whitespace."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "table"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def extract_sections(text: str) -> list[dict]:
    """Detect 'Item X.' sections in 10-K text.

    10-Ks list items twice: once in the Table of Contents and once with actual
    content. We keep only the last 15 matches as a coarse de-duplication —
    works reliably because real content always follows the TOC.
    """
    matches = list(ITEM_PATTERN.finditer(text))
    sections: list[dict] = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append({
            "item": match.group(1),
            "title": match.group(2).strip()[:80],
            "text": text[start:end].strip(),
        })
    return sections[-15:] if len(sections) > 15 else sections


def _resolve_ticker(filing_path: Path) -> str:
    """Walk up from filing_path looking for a 'sec-edgar-filings/<TICKER>/' segment.

    sec-edgar-downloader v5 lays out as:
      data/raw/sec-edgar-filings/AAPL/10-K/0000320193-24-000123/full-submission.txt
    """
    for part in filing_path.parts:
        if part.isupper() and 1 <= len(part) <= 5 and part.isalpha():
            return part
    # Fallback: pick the directory two above 10-K
    parts = filing_path.parts
    if "10-K" in parts:
        idx = parts.index("10-K")
        if idx >= 1:
            return parts[idx - 1]
    return "UNKNOWN"


def preprocess_filing(filing_path: Path) -> dict:
    """Process one 10-K file end-to-end."""
    submission = filing_path.read_text(encoding="utf-8", errors="ignore")
    html = extract_10k_html(submission)
    text = html_to_text(html)
    sections = extract_sections(text)

    return {
        "ticker": _resolve_ticker(filing_path),
        "filing_path": str(filing_path),
        "char_count": len(text),
        "section_count": len(sections),
        "sections": sections,
    }
