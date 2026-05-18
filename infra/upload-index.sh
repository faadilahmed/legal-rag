#!/usr/bin/env bash
# Uploads the FAISS + BM25 index from data/processed/index/ to Azure Blob.
# Reads resource names from infra/deploy.env (created by deploy.sh).

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=infra/deploy.env
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Run infra/deploy.sh first." >&2
  exit 1
fi
source "$ENV_FILE"

echo "[upload] account=$STG container=rag-index"
echo "[upload] uploading data/processed/index/{faiss.index, bm25.pkl, chunks.pkl, embeddings.npy}"
echo "[upload] this is ~1.1 GB; expect 5-15 minutes on home upload bandwidth"

az storage blob upload-batch \
  --account-name "$STG" \
  --account-key "$STG_KEY" \
  --destination rag-index \
  --source data/processed/index \
  --overwrite true \
  --output table

echo "[upload] DONE"
