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


# Matches a title that is a cross-reference fragment rather than a real section heading.
# Cross-refs start with lowercase letters, connector words, or punctuation.
# Real headings start with an uppercase letter or digit (e.g. "Risk Factors", "Business").
_XREF_START = re.compile(
    r'^[a-z,;()\[\]\'".\-–—]'   # starts with lowercase or punctuation
    r'|^(?:of|in|under|from|to|and|or|the)\b',  # or connector word (case-insensitive)
    re.IGNORECASE,
)


def _title_score(title: str) -> int:
    """Return 1 if this looks like a real section heading, 0 if a cross-reference fragment.

    Real headings: "Risk Factors", "Business", "Financial Statements..."
    Cross-refs: "of this Form 10-K...", ", 'Financial Statements...'", "under the heading..."
    """
    stripped = title.strip()
    if not stripped:
        return 0
    # Check lowercase-start separately (IGNORECASE would make [a-z] match uppercase too)
    if stripped[0].islower() or stripped[0] in ',;()[]\'\".-–—':
        return 0
    # Check connector words (case-insensitive)
    if re.match(r'^(?:of|in|under|from|to|and|or|the)\b', stripped, re.IGNORECASE):
        return 0
    return 1


def extract_sections(text: str) -> list[dict]:
    """Detect 'Item X.' sections in 10-K text.

    10-Ks reference each Item multiple times: in the Table of Contents, in
    the section content, and in cross-references from other items
    ("see Item 1A"). We deduplicate by keeping, for each unique item number,
    the occurrence that looks most like a real section heading.

    Selection priority (highest wins):
      1. Title looks like a real heading (not a cross-reference fragment)
      2. Longest text span

    TOC entries span ~50-100 chars; content sections span thousands. Within
    real headings, the longest span is reliably the content section. The
    title-score check handles edge cases where a cross-reference incidentally
    spans more text than the real section (e.g. AAPL Item 1A).
    """
    matches = list(ITEM_PATTERN.finditer(text))
    if not matches:
        return []

    spans = []
    for i, match in enumerate(matches):
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        title = match.group(2).strip()[:80]
        spans.append({
            "item": match.group(1).upper(),
            "title": title,
            "start": start,
            "end": end,
            "text": text[start:end].strip(),
            "length": end - start,
            "score": _title_score(title),
        })

    # For each unique item number, keep the best occurrence:
    # prefer real headings (score=1) over cross-refs (score=0), then longest span.
    by_item: dict[str, dict] = {}
    for span in spans:
        item = span["item"]
        if item not in by_item:
            by_item[item] = span
        else:
            current = by_item[item]
            if (span["score"], span["length"]) > (current["score"], current["length"]):
                by_item[item] = span

    # Return in document order so consumers see Items 1, 1A, 1B, ... in order.
    sections_sorted = sorted(by_item.values(), key=lambda s: s["start"])
    return [
        {"item": s["item"], "title": s["title"], "text": s["text"]}
        for s in sections_sorted
    ]


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
