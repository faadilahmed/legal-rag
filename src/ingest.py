"""Stage 1: Download the most recent 10-K filing for each ticker from SEC EDGAR."""
from sec_edgar_downloader import Downloader

from src.config import RAW_DIR, SEC_USER_AGENT, TICKERS


def parse_user_agent(user_agent: str) -> tuple[str, str]:
    """Split a 'Name Name email@domain' string into (name, email).

    SEC requires a real contact email in the User-Agent header. The spec stores
    name+email in one config string; we split on the last whitespace so multi-token
    names like 'Faadil Ahmed' parse correctly.
    """
    name, _, email = user_agent.rpartition(" ")
    if not name:
        raise ValueError(f"SEC_USER_AGENT must contain a name and email: got {user_agent!r}")
    if "@" not in email:
        raise ValueError(f"SEC_USER_AGENT email portion is invalid: got {email!r}")
    return name, email


# How many most-recent 10-Ks to pull per ticker. 5 years gives enough
# temporal coverage for evolution queries ("how has Apple's China-risk
# language changed?") without an unreasonable download / build cost.
FILINGS_PER_TICKER = 5


def ingest_filings(
    tickers: list[str] = TICKERS,
    limit: int = FILINGS_PER_TICKER,
) -> dict[str, str]:
    """Download the most recent `limit` 10-Ks per ticker. Returns {ticker: 'ok' | error_msg}.

    sec-edgar-downloader handles rate-limiting (10 req/s ceiling) automatically.
    Filings land under RAW_DIR/<ticker>/10-K/<accession>/full-submission.txt.
    If a ticker has fewer than `limit` historical 10-Ks (e.g., newer IPO),
    EDGAR returns whatever is available — no error.
    """
    name, email = parse_user_agent(SEC_USER_AGENT)
    dl = Downloader(name, email, str(RAW_DIR))

    results: dict[str, str] = {}
    for ticker in tickers:
        try:
            dl.get("10-K", ticker, limit=limit)
            results[ticker] = "ok"
            print(f"✓ {ticker}")
        except Exception as e:
            results[ticker] = f"error: {e}"
            print(f"✗ {ticker}: {e}")
    return results


if __name__ == "__main__":
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    results = ingest_filings()
    ok = sum(1 for v in results.values() if v == "ok")
    print(f"\nDownloaded {ok}/{len(results)} filings.")
