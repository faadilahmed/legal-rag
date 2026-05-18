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


CHAT_SYSTEM_PROMPT = SYSTEM_PROMPT + """

Conversation rules:
- The user may ask follow-up questions referring to prior turns ("that company", "the second risk", etc.).
- Resolve such references against the conversation so far and the current context.
- If the current context does not support the follow-up, say so explicitly rather than guessing.
"""

CHAT_USER_TEMPLATE = """Context from SEC 10-K filings:

{context}

Current question: {query}

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

    def generate_chat(
        self,
        query: str,
        chunks: list[dict],
        history: list[dict] | None = None,
    ) -> dict:
        """Multi-turn variant of generate().

        `history` is a list of {"role": "user"|"assistant", "content": str}
        ordered oldest-to-newest, NOT including the current `query`. The
        current query, wrapped with retrieved context, becomes the final
        user message.
        """
        history = history or []
        context_msg = CHAT_USER_TEMPLATE.format(
            context=self._format_context(chunks), query=query
        )
        messages = [*history, {"role": "user", "content": context_msg}]

        response = self.client.messages.create(
            model=self.model,
            max_tokens=1024,
            system=CHAT_SYSTEM_PROMPT,
            messages=messages,
        )
        answer = response.content[0].text
        citations = sorted(set(CITATION_PATTERN.findall(answer)))
        return {"answer": answer, "citations": citations, "chunks_used": chunks}

    def stream_chat(
        self,
        query: str,
        chunks: list[dict],
        history: list[dict] | None = None,
        extra_system: str | None = None,
    ):
        """Streaming multi-turn. Returns the Anthropic stream context manager.

        Caller pattern:
            with generator.stream_chat(query, chunks, history) as stream:
                for text in stream.text_stream:
                    # forward text to client
                    ...
                final = stream.get_final_message()  # for usage stats

        `extra_system` is appended to CHAT_SYSTEM_PROMPT — used by the chat
        service to inject runtime-computed corpus metadata so the model can
        answer meta-questions about the knowledge base it has access to.

        The caller is responsible for accumulating tokens and persisting the
        final message; this method does not accumulate or persist.
        """
        history = history or []
        context_msg = CHAT_USER_TEMPLATE.format(
            context=self._format_context(chunks), query=query
        )
        messages = [*history, {"role": "user", "content": context_msg}]
        system = CHAT_SYSTEM_PROMPT
        if extra_system:
            system = f"{system}\n\n{extra_system}"
        return self.client.messages.stream(
            model=self.model,
            max_tokens=1024,
            system=system,
            messages=messages,
        )
