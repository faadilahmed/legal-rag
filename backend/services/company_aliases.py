"""Map of company-name aliases → ticker symbols, used to auto-detect when
a user's query names specific companies. When detected, we apply the
corresponding tickers as a retrieval scope filter automatically so the
retriever returns chunks from those companies instead of semantically
similar chunks from other companies.

The map is hand-curated for the 78 tickers in the corpus. Keys are
lowercased substrings to match against (using word-boundary regex). Values
are the canonical ticker symbol.

Multiple aliases per ticker handle the common ways analysts write company
names: ticker symbols (uppercased in the query), short forms ('Apple',
'Microsoft'), full legal names ('Apple Inc.'), informal shorthands
('BofA', 'JPM Chase'), and parent/brand names (Google vs Alphabet).
"""
import re

# (alias_lowercase, ticker). Order doesn't matter for correctness — we scan
# the entire query against all aliases. Longer aliases are preferred over
# shorter ones (e.g., 'morgan stanley' wins over 'morgan') via the sort below.
_ALIASES: dict[str, str] = {
    # Tech
    "aapl": "AAPL", "apple": "AAPL", "apple inc": "AAPL",
    "msft": "MSFT", "microsoft": "MSFT",
    "googl": "GOOGL", "google": "GOOGL", "alphabet": "GOOGL",
    "meta": "META", "meta platforms": "META", "facebook": "META",
    "amzn": "AMZN", "amazon": "AMZN",
    "nvda": "NVDA", "nvidia": "NVDA",
    "tsla": "TSLA", "tesla": "TSLA",
    "orcl": "ORCL", "oracle": "ORCL",
    "crm": "CRM", "salesforce": "CRM",
    "adbe": "ADBE", "adobe": "ADBE",

    # Finance — ordered alias_lowercase: ticker
    "jpm": "JPM", "jpmorgan": "JPM", "jpmorgan chase": "JPM",
    "jp morgan": "JPM", "j.p. morgan": "JPM",
    "bac": "BAC", "bank of america": "BAC", "bofa": "BAC",
    "gs": "GS", "goldman": "GS", "goldman sachs": "GS",
    "morgan stanley": "MS",  # "MS" alone is too ambiguous (could be Microsoft typo etc.)
    "wfc": "WFC", "wells fargo": "WFC",
    "citi": "C", "citigroup": "C", "citibank": "C",
    "blk": "BLK", "blackrock": "BLK",
    "schw": "SCHW", "schwab": "SCHW", "charles schwab": "SCHW",
    "axp": "AXP", "american express": "AXP", "amex": "AXP",
    "usb": "USB", "us bancorp": "USB", "u.s. bancorp": "USB",

    # Healthcare
    "pfe": "PFE", "pfizer": "PFE",
    "jnj": "JNJ", "johnson & johnson": "JNJ", "johnson and johnson": "JNJ",
    "unh": "UNH", "unitedhealth": "UNH", "united health": "UNH", "united healthcare": "UNH",
    "cvs": "CVS", "cvs health": "CVS",
    "mrk": "MRK", "merck": "MRK",
    "abbv": "ABBV", "abbvie": "ABBV",
    "lly": "LLY", "eli lilly": "LLY", "lilly": "LLY",
    "bmy": "BMY", "bristol myers": "BMY", "bristol-myers": "BMY", "bristol myers squibb": "BMY",
    "tmo": "TMO", "thermo fisher": "TMO", "thermo fisher scientific": "TMO",
    "amgn": "AMGN", "amgen": "AMGN",

    # Energy
    "xom": "XOM", "exxon": "XOM", "exxonmobil": "XOM", "exxon mobil": "XOM",
    "cvx": "CVX", "chevron": "CVX",
    "cop": "COP", "conocophillips": "COP", "conoco": "COP",
    "slb": "SLB", "schlumberger": "SLB",
    "eog": "EOG", "eog resources": "EOG",
    "psx": "PSX", "phillips 66": "PSX",
    "vlo": "VLO", "valero": "VLO", "valero energy": "VLO",
    "oxy": "OXY", "occidental": "OXY", "occidental petroleum": "OXY",
    "mpc": "MPC", "marathon petroleum": "MPC",
    "kmi": "KMI", "kinder morgan": "KMI",

    # Consumer
    "wmt": "WMT", "walmart": "WMT", "wal-mart": "WMT",
    "pg": "PG", "procter & gamble": "PG", "procter and gamble": "PG", "p&g": "PG",
    "ko": "KO", "coca-cola": "KO", "coca cola": "KO", "coke": "KO",
    "mcd": "MCD", "mcdonald's": "MCD", "mcdonalds": "MCD",
    "nke": "NKE", "nike": "NKE",
    "pep": "PEP", "pepsi": "PEP", "pepsico": "PEP",
    "cost": "COST", "costco": "COST",
    "tgt": "TGT", "target": "TGT",
    "hd": "HD", "home depot": "HD",
    "low": "LOW", "lowe's": "LOW", "lowes": "LOW",

    # Industrial
    "ba": "BA", "boeing": "BA",
    "cat": "CAT", "caterpillar": "CAT",
    "ge": "GE", "general electric": "GE", "ge aerospace": "GE",
    "hon": "HON", "honeywell": "HON",
    "unp": "UNP", "union pacific": "UNP",
    "rtx": "RTX", "raytheon": "RTX", "rtx corporation": "RTX",
    "lmt": "LMT", "lockheed martin": "LMT", "lockheed": "LMT",
    "de": "DE", "deere": "DE", "john deere": "DE",
    "mmm": "MMM", "3m": "MMM",
    "emr": "EMR", "emerson": "EMR", "emerson electric": "EMR",

    # Telecom/Media
    "vz": "VZ", "verizon": "VZ",
    "t": "T", "at&t": "T", "at and t": "T", "att": "T",
    "tmus": "TMUS", "t-mobile": "TMUS", "tmobile": "TMUS",
    "cmcsa": "CMCSA", "comcast": "CMCSA",
    "nflx": "NFLX", "netflix": "NFLX",
    "dis": "DIS", "disney": "DIS", "walt disney": "DIS",

    # Real Estate
    "pld": "PLD", "prologis": "PLD",
    "amt": "AMT", "american tower": "AMT",
    "spg": "SPG", "simon property": "SPG", "simon property group": "SPG",
    "eqix": "EQIX", "equinix": "EQIX",

    # Utilities
    "nee": "NEE", "nextera": "NEE", "nextera energy": "NEE",
    "so": "SO", "southern company": "SO", "the southern company": "SO",
    "duk": "DUK", "duke energy": "DUK",
    "aep": "AEP", "american electric power": "AEP",

    # Materials
    "lin": "LIN", "linde": "LIN",
    "apd": "APD", "air products": "APD",
    "shw": "SHW", "sherwin-williams": "SHW", "sherwin williams": "SHW",
    "fcx": "FCX", "freeport": "FCX", "freeport-mcmoran": "FCX", "freeport mcmoran": "FCX",
}

# Tickers that are common English words / short letters and would create
# false positives if their UPPERCASE form was matched case-insensitively
# against natural-language queries (e.g., "T" the conjunction). The bare
# uppercase form of these tickers is only accepted as an ALL-CAPS standalone
# token. Multi-word aliases ("Goldman Sachs", "Wells Fargo") that happen to
# map to these tickers are NOT affected — those are always unambiguous and
# matched case-insensitively like any other full company name.
_AMBIGUOUS_BARE_TICKERS = {
    # Single-letter and common-English tickers that need ALL-CAPS in the
    # query to count as a match. Longer / clearly non-English tickers
    # (AAPL, MSFT, NVDA, JPM, GOOGL, etc.) are matched case-insensitively
    # — "aapl" in a query unambiguously means Apple.
    "T", "SO", "C", "GE", "HD", "BA", "DE", "MS", "KO", "PG", "GS",
    "COP", "CAT", "DIS", "LOW",
}

# Pre-build a list of (compiled_regex, ticker, alias), longest-alias-first so
# that 'goldman sachs' wins over 'goldman' when both are in the query. Bound
# aliases on word boundaries so 'apple' doesn't match 'appleseed'. Multi-word
# aliases (containing whitespace or any non-word char) are always treated as
# unambiguous and matched case-insensitively. Bare uppercase ticker aliases
# in _AMBIGUOUS_BARE_TICKERS require ALL-CAPS exact match in the query.
_PATTERNS: list[tuple[re.Pattern[str], str, str, bool]] = []  # pattern, ticker, alias, requires_uppercase
for alias, ticker in sorted(_ALIASES.items(), key=lambda x: -len(x[0])):
    # Multi-word aliases (e.g., "goldman sachs", "jp morgan") and aliases
    # with punctuation (e.g., "j.p. morgan") are always unambiguous.
    is_multi_word = " " in alias or any(not c.isalnum() for c in alias)
    # Bare ticker alias: the alias is just the ticker symbol (case-insensitive
    # match against the ticker). e.g., alias "so" or "SO" with ticker "SO".
    is_bare_ticker = alias.upper() == ticker and not is_multi_word
    requires_uppercase = is_bare_ticker and ticker in _AMBIGUOUS_BARE_TICKERS

    # For strict ambiguous tickers, the literal pattern text must be the
    # UPPERCASE ticker (so 'so' in the map becomes pattern 'SO' with no
    # ignorecase flag). For everything else, use the alias as-written with
    # ignorecase so 'apple', 'Apple', 'APPLE' all match.
    if requires_uppercase:
        text = ticker
        flags = 0
    else:
        text = alias
        flags = re.IGNORECASE
    escaped = re.escape(text)
    if text[-1].isalnum() and text[0].isalnum():
        pat_str = rf"\b{escaped}\b"
    else:
        pat_str = rf"(?<![a-z0-9]){escaped}(?![a-z0-9])"
    _PATTERNS.append((re.compile(pat_str, flags), ticker, alias, requires_uppercase))


def detect_query_tickers(query: str) -> set[str]:
    """Scan the query for company aliases and return the set of matched tickers.

    Single-token uppercase ticker symbols whose lowercase form is a common
    English word (e.g., "T", "SO", "BA", "DE", "GS") are only matched when
    they appear as ALL-CAPS standalone tokens in the query. Multi-word
    aliases ("Goldman Sachs", "Wells Fargo", "JP Morgan") and most longer
    aliases are matched case-insensitively.

    So 'How do JPMorgan, Goldman Sachs, and Wells Fargo compare?' yields
    {'JPM', 'GS', 'WFC'}; 'so what?' does NOT yield {'SO'}.

    Returns an empty set if no company name is detected.
    """
    if not query:
        return set()
    hits: set[str] = set()
    for pattern, ticker, _alias, _requires_upper in _PATTERNS:
        if pattern.search(query):
            hits.add(ticker)
    return hits
