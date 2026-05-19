"""Pull the FAISS + BM25 index from Azure Blob Storage at cold-start time.

When the backend runs locally (developer machine), the index already lives at
`data/processed/index/` from the build step and this loader is a no-op. When
the backend runs in Azure Container Apps, the container image is intentionally
small (no 1.1 GB index baked in); the index files are hosted in a blob
container and downloaded into a writable mount on first cold start.

This module is opt-in: callers check `should_load_from_blob()` first. If the
required env vars aren't set (i.e. we're running locally), nothing happens.
"""
import logging
import os
from pathlib import Path

LOGGER = logging.getLogger(__name__)

# Files the RAGPipeline expects at INDEX_DIR. The blob container name + blob
# names must match this set 1:1.
REQUIRED_FILES = ("faiss.index", "bm25.pkl", "chunks.pkl", "embeddings.npy")


def should_load_from_blob() -> bool:
    """True when the env explicitly opts in (i.e. running in Azure).

    Two forms accepted:
      - AZURE_STORAGE_CONNECTION_STRING (single semicolon-delimited string)
      - AZURE_STORAGE_ACCOUNT_NAME + AZURE_STORAGE_ACCOUNT_KEY (preferred for
        Azure Container Apps; `;` in the connection string gets eaten by the
        `--set-env-vars` / `--secrets` CLI parser).
    """
    if os.environ.get("AZURE_STORAGE_CONNECTION_STRING"):
        return True
    if os.environ.get("AZURE_STORAGE_ACCOUNT_NAME") and os.environ.get(
        "AZURE_STORAGE_ACCOUNT_KEY"
    ):
        return True
    return False


def _build_blob_service_client():
    """Construct a BlobServiceClient from whichever env form is present."""
    from azure.storage.blob import BlobServiceClient

    conn = os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    if conn:
        return BlobServiceClient.from_connection_string(conn)
    name = os.environ["AZURE_STORAGE_ACCOUNT_NAME"]
    key = os.environ["AZURE_STORAGE_ACCOUNT_KEY"]
    return BlobServiceClient(
        account_url=f"https://{name}.blob.core.windows.net",
        credential=key,
    )


def ensure_index_present(
    target_dir: Path,
    container: str | None = None,
) -> None:
    """Idempotent: download missing index files from Azure Blob.

    No-op when already cached locally OR when the env isn't configured. Safe to
    call on every startup — the first cold start downloads ~1.1 GB and
    subsequent restarts (within the same container instance lifetime) hit the
    local cache.
    """
    target_dir.mkdir(parents=True, exist_ok=True)
    missing = [name for name in REQUIRED_FILES if not (target_dir / name).exists()]
    if not missing:
        print(f"[blob_loader] all {len(REQUIRED_FILES)} index files already cached at {target_dir}", flush=True)
        return

    if not should_load_from_blob():
        # Local dev path: nothing to do, the build step writes these files.
        print(
            f"[blob_loader] missing {missing} but blob env not set; "
            "assuming local build artifacts will be used.",
            flush=True,
        )
        return

    container = container or os.environ.get("LEGAL_RAG_BLOB_CONTAINER", "rag-index")

    print(f"[blob_loader] downloading {len(missing)} files from container '{container}'...", flush=True)
    svc = _build_blob_service_client()
    container_client = svc.get_container_client(container)

    for name in missing:
        dst = target_dir / name
        print(f"[blob_loader] fetching {name} ...", flush=True)
        blob_client = container_client.get_blob_client(name)
        # Stream chunks instead of readall() — readall() loads the entire
        # blob into RAM and OOM-kills the container on tight memory limits.
        # Chunked download peaks at ~4 MB of RAM per blob regardless of size.
        downloader = blob_client.download_blob(max_concurrency=2)
        with open(dst, "wb") as f:
            for chunk in downloader.chunks():
                f.write(chunk)
        print(f"[blob_loader] wrote {dst} ({dst.stat().st_size:,} bytes)", flush=True)

    print(f"[blob_loader] index ready at {target_dir}", flush=True)
