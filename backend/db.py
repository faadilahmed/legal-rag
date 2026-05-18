"""SQLite schema initialization. Idempotent — safe to call on every startup."""
import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS threads (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL DEFAULT 'New chat',
    created_at   INTEGER NOT NULL,
    updated_at   INTEGER NOT NULL,
    archived     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ix_threads_updated_at ON threads(updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
    id           TEXT PRIMARY KEY,
    thread_id    TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content      TEXT NOT NULL,
    sources_json TEXT,
    trace_json   TEXT,
    created_at   INTEGER NOT NULL,
    seq          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_messages_thread_seq ON messages(thread_id, seq);
"""


def init_schema(db_path: Path) -> None:
    """Create tables, indexes, and set PRAGMAs. Safe to call repeatedly."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA)
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        # Idempotent column adds for evolving schemas. PRAGMA returns
        # (cid, name, type, notnull, dflt_value, pk) per column.
        existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(messages)")}
        if "trace_json" not in existing_cols:
            conn.execute("ALTER TABLE messages ADD COLUMN trace_json TEXT")
        conn.commit()
    finally:
        conn.close()
