"""Stage 10: End-to-end orchestrator. Wires embedder + index + retriever + reranker + generator."""
from pathlib import Path

from src.config import DENSE_TOP_K, INDEX_DIR, RERANK_TOP_K
from src.embed import Embedder
from src.generate import Generator
from src.index import HybridIndex
from src.rerank import Reranker
from src.retrieve import HybridRetriever


class RAGPipeline:
    def __init__(self, embedder, index, retriever, reranker, generator):
        self.embedder = embedder
        self.index = index
        self.retriever = retriever
        self.reranker = reranker
        self.generator = generator

    @classmethod
    def load(cls, index_dir: Path = INDEX_DIR) -> "RAGPipeline":
        """Load all components from a pre-built index on disk."""
        embedder = Embedder()
        index = HybridIndex.load(index_dir)
        retriever = HybridRetriever(index, embedder)
        reranker = Reranker()
        generator = Generator()
        return cls(embedder, index, retriever, reranker, generator)

    def answer(self, query: str) -> dict:
        """Full RAG path: retrieve top-50, rerank to top-5, generate."""
        candidates = self.retriever.retrieve(query, k=DENSE_TOP_K)
        reranked = self.reranker.rerank(query, candidates, top_k=RERANK_TOP_K)
        result = self.generator.generate(query, reranked)
        return {
            "query": query,
            "answer": result["answer"],
            "citations": result["citations"],
            "chunks": reranked,
        }
