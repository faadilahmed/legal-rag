"""Stage 11: Gradio UI — chat interface with a side panel showing source chunks."""
import sys
from pathlib import Path

# Allow running as `python app/gradio_app.py` from the project root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import gradio as gr  # noqa: E402

from src.pipeline import RAGPipeline  # noqa: E402

pipeline = RAGPipeline.load()


def answer_question(query: str, history: list) -> tuple:
    """Run one query through the pipeline; return updated chat history, sources panel, cleared input."""
    if not query.strip():
        return history, "", ""

    result = pipeline.answer(query)

    sources_md = "\n\n".join([
        f"**{c['ticker']} · Item {c['item']}** — score: `{c['rerank_score']:.2f}`\n\n"
        f"> {c['text'][:300]}..."
        for c in result["chunks"]
    ])

    history = history + [(query, result["answer"])]
    return history, sources_md, ""


with gr.Blocks(theme=gr.themes.Soft(), title="SEC 10-K Q&A") as demo:
    gr.Markdown("# 📊 SEC 10-K Q&A")
    gr.Markdown(
        "*Hybrid retrieval over ~78 SEC filings · citation-grounded answers · "
        "built with sentence-transformers, FAISS, BM25, and Claude*"
    )

    with gr.Row():
        with gr.Column(scale=2):
            chatbot = gr.Chatbot(label="Answer", height=500, show_label=False)
            msg = gr.Textbox(
                placeholder="What are Apple's main supply chain risks?",
                show_label=False,
            )
            with gr.Row():
                submit = gr.Button("Ask", variant="primary")
                clear = gr.Button("Clear")

            gr.Examples(
                examples=[
                    "What are Apple's main supply chain risks?",
                    "Which companies cite AI as a competitive threat?",
                    "How do banks describe regulatory risk in 2024?",
                    "What are the most common ESG-related risks across sectors?",
                ],
                inputs=msg,
            )

        with gr.Column(scale=1):
            gr.Markdown("### Sources")
            sources = gr.Markdown()

    submit.click(answer_question, [msg, chatbot], [chatbot, sources, msg])
    msg.submit(answer_question, [msg, chatbot], [chatbot, sources, msg])
    clear.click(lambda: ([], "", ""), outputs=[chatbot, sources, msg])


if __name__ == "__main__":
    demo.launch()
