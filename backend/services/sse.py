"""SSE wire encoder for the assistant-ui Data Stream protocol.

Each frame is a single line: <code>:<json>\\n

- 0: text delta (JSON-encoded string)
- 2: custom data part {type, value}
- d: done marker {finishReason, usage}
- 3: error (JSON-encoded string)
"""
import json


def text_delta(s: str) -> bytes:
    return f"0:{json.dumps(s)}\n".encode()


def data_part(type_: str, value: dict) -> bytes:
    return f"2:{json.dumps({'type': type_, 'value': value})}\n".encode()


def done(finish_reason: str = "stop", usage: dict | None = None) -> bytes:
    return f"d:{json.dumps({'finishReason': finish_reason, 'usage': usage or {}})}\n".encode()


def error(message: str) -> bytes:
    return f"3:{json.dumps(message)}\n".encode()
