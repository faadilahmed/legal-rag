"""Stage 8: Generate cited answers via Claude with a citation-grounded prompt.

The system prompt forbids hallucination outside the supplied context and requires
inline [chunk_id] citations. The chunks_used field in the return is what the UI
displays as a sources panel and what RAGAS treats as 'contexts' during eval.
"""
import os
import re

from anthropic import Anthropic
from dotenv import load_dotenv

from src.config import GENERATOR_MODEL

load_dotenv()


SYSTEM_PROMPT = """You are a financial analyst answering questions about SEC 10-K filings.

Rules:
1. Use ONLY the provided context to answer.
2. Cite sources inline using [chunk_id] notation after each claim.
3. If the answer is not in the context, say "I don't have enough information to answer this question."
4. Be concise but complete — typically 2-5 sentences.
5. Quote specific language when it strengthens the answer."""

USER_TEMPLATE = """Context from SEC 10-K filings:

{context}

Question: {query}

Answer with inline citations [chunk_id]:"""


CITATION_PATTERN = re.compile(r"\[([A-Za-z0-9_]+)\]")


class Generator:
    def __init__(self):
        self.client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
        self.model = GENERATOR_MODEL

    def _format_context(self, chunks: list[dict]) -> str:
        return "\n\n".join([
            f"[chunk_id: {c['chunk_id']} | {c['ticker']} | Item {c['item']}]\n{c['text']}"
            for c in chunks
        ])

    def generate(self, query: str, chunks: list[dict]) -> dict:
        prompt = USER_TEMPLATE.format(context=self._format_context(chunks), query=query)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        answer = response.content[0].text
        citations = sorted(set(CITATION_PATTERN.findall(answer)))

        return {
            "answer": answer,
            "citations": citations,
            "chunks_used": chunks,
        }
