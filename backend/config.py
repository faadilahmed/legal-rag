"""Backend-only settings. Reads from env where useful."""
import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("LEGAL_RAG_DB_PATH", BACKEND_DIR / "data" / "chat.db"))
CORS_ORIGINS = os.environ.get("LEGAL_RAG_CORS_ORIGINS", "http://localhost:5173").split(",")
