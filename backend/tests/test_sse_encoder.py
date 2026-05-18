"""Unit tests for the SSE wire encoder. Bytes must be EXACT."""
from backend.services import sse


def test_text_delta_format():
    assert sse.text_delta("hello") == b'0:"hello"\n'


def test_text_delta_escapes_quotes_and_newlines():
    assert sse.text_delta('he said "hi"\nbye') == b'0:"he said \\"hi\\"\\nbye"\n'


def test_text_delta_handles_unicode():
    # JSON encodes non-ASCII by default with ensure_ascii (Python's default is True)
    assert sse.text_delta("résumé") == b'0:"r\\u00e9sum\\u00e9"\n'


def test_data_part_format():
    out = sse.data_part("sources", {"chunks": [{"id": "x"}]})
    assert out == b'2:{"type": "sources", "value": {"chunks": [{"id": "x"}]}}\n'


def test_done_default():
    assert sse.done() == b'd:{"finishReason": "stop", "usage": {}}\n'


def test_done_with_usage():
    out = sse.done("stop", {"promptTokens": 100, "completionTokens": 50})
    assert b'"finishReason": "stop"' in out
    assert b'"promptTokens": 100' in out
    assert b'"completionTokens": 50' in out


def test_error_format():
    assert sse.error("boom") == b'3:"boom"\n'
