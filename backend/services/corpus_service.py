"""Builds and serves the sector → ticker → items tree from the in-memory
RAGPipeline.index.chunks. Eagerly built on first access and cached on
app.state for the lifetime of the process."""
from collections import defaultdict
from typing import Iterable


# Sector mapping mirrors the comment blocks in src/config.py:TICKERS.
# Hardcoded here because parsing the config.py comments is brittle and we
# need this to be the single source of truth for the UI tree.
SECTOR_OF: dict[str, str] = {
    # Tech
    **{t: "Tech" for t in ["AAPL", "MSFT", "GOOGL", "META", "AMZN", "NVDA", "TSLA", "ORCL", "CRM", "ADBE"]},
    # Finance
    **{t: "Finance" for t in ["JPM", "BAC", "GS", "MS", "WFC", "C", "BLK", "SCHW", "AXP", "USB"]},
    # Healthcare
    **{t: "Healthcare" for t in ["PFE", "JNJ", "UNH", "CVS", "MRK", "ABBV", "LLY", "BMY", "TMO", "AMGN"]},
    # Energy
    **{t: "Energy" for t in ["XOM", "CVX", "COP", "SLB", "EOG", "PSX", "VLO", "OXY", "MPC", "KMI"]},
    # Consumer
    **{t: "Consumer" for t in ["WMT", "PG", "KO", "MCD", "NKE", "PEP", "COST", "TGT", "HD", "LOW"]},
    # Industrial
    **{t: "Industrial" for t in ["BA", "CAT", "GE", "HON", "UNP", "RTX", "LMT", "DE", "MMM", "EMR"]},
    # Telecom/Media
    **{t: "Telecom/Media" for t in ["VZ", "T", "TMUS", "CMCSA", "NFLX", "DIS"]},
    # Real Estate
    **{t: "Real Estate" for t in ["PLD", "AMT", "SPG", "EQIX"]},
    # Utilities
    **{t: "Utilities" for t in ["NEE", "SO", "DUK", "AEP"]},
    # Materials
    **{t: "Materials" for t in ["LIN", "APD", "SHW", "FCX"]},
}

# Canonical sector display order matching config.py comment blocks
SECTOR_ORDER = [
    "Tech", "Finance", "Healthcare", "Energy", "Consumer",
    "Industrial", "Telecom/Media", "Real Estate", "Utilities", "Materials",
]


def build_corpus_tree(chunks: list[dict]) -> dict:
    """Build the sector → ticker → items tree from a chunk list.

    Returns:
        {
          "sectors": [
            {"name": "Tech", "ticker_count": 10, "chunk_count": 3756, "tickers": [
              {"ticker": "AAPL", "chunk_count": 357, "items": [
                {"item": "1A", "chunk_count": 88}, ...
              ]}, ...
            ]}, ...
          ]
        }
    """
    # chunks_by_ticker_item[ticker][item] = count
    by_ticker: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for c in chunks:
        by_ticker[c["ticker"]][c["item"]] += 1

    # Group tickers by sector
    sector_to_tickers: dict[str, list[str]] = defaultdict(list)
    for ticker in by_ticker:
        sector = SECTOR_OF.get(ticker, "Other")
        sector_to_tickers[sector].append(ticker)

    sectors_out = []
    for sector in SECTOR_ORDER + ["Other"]:
        if sector not in sector_to_tickers:
            continue
        tickers_sorted = sorted(sector_to_tickers[sector])
        tickers_out = []
        sector_chunk_count = 0
        for ticker in tickers_sorted:
            items_dict = by_ticker[ticker]
            items_sorted = sorted(items_dict.keys(), key=_item_sort_key)
            items_out = [
                {"item": item, "chunk_count": items_dict[item]}
                for item in items_sorted
            ]
            ticker_chunks = sum(items_dict.values())
            sector_chunk_count += ticker_chunks
            tickers_out.append({
                "ticker": ticker,
                "chunk_count": ticker_chunks,
                "items": items_out,
            })
        sectors_out.append({
            "name": sector,
            "ticker_count": len(tickers_out),
            "chunk_count": sector_chunk_count,
            "tickers": tickers_out,
        })

    return {"sectors": sectors_out}


def _item_sort_key(item: str) -> tuple:
    """Sort Items naturally: 1, 1A, 1B, 1C, 2, ..., 7, 7A, 8, 9, 9A, 9B, 9C, 10, ...
    Unknown/exhibit items (e.g., "601") sort last."""
    import re
    m = re.match(r"^(\d+)([A-Z]?)$", item.upper())
    if not m:
        return (10_000, item)
    n = int(m.group(1))
    suffix = m.group(2) or ""
    # Exhibits like "601" or "408" are outside the standard 1-16 range; bucket high.
    if n > 16:
        return (5_000 + n, suffix)
    return (n, suffix)


def build_chunk_id_index(chunks: list[dict]) -> dict[str, int]:
    """Map chunk_id → positional index in chunks list. Built once for O(1) lookups."""
    return {c["chunk_id"]: i for i, c in enumerate(chunks)}
