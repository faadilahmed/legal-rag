# syntax=docker/dockerfile:1.6
#
# Backend container for Azure Container Apps deployment.
#
# Build for amd64 explicitly on Apple Silicon dev machines — Container Apps
# runs amd64 and a host-arch image will silently fail to start:
#
#     docker buildx build --platform linux/amd64 -t legal-rag-backend .
#
# The FAISS + BM25 index is NOT baked into the image (it's 1.1 GB and lives in
# Azure Blob Storage). The backend's lifespan handler downloads it on cold
# start via backend/services/blob_loader.py.
#
# What IS baked in: Python deps, the sentence-transformers and cross-encoder
# model weights (~200 MB combined), and the application source.

FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.hf_cache \
    LEGAL_RAG_INDEX_DIR=/app/index_cache \
    LEGAL_RAG_DB_PATH=/app/chat-data/chat.db

# System deps. libgomp1 is required by faiss-cpu's OpenMP runtime.
# build-essential is needed by some wheels that don't ship binaries for slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install -r requirements.txt

# Warm the HuggingFace cache so cold-start isn't paying for model downloads
# from huggingface.co (~200 MB combined). The model files live under HF_HOME.
RUN python -c "from sentence_transformers import SentenceTransformer, CrossEncoder; \
    SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2'); \
    CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

# Application source.
COPY src/ ./src/
COPY backend/ ./backend/

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
