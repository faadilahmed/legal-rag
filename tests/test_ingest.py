"""Tests for ingest.py — focused on the user-agent parsing fix."""
from src.ingest import parse_user_agent


def test_parse_user_agent_two_token_name():
    name, email = parse_user_agent("Faadil Ahmed faadil.ahmed2@gmail.com")
    assert name == "Faadil Ahmed"
    assert email == "faadil.ahmed2@gmail.com"


def test_parse_user_agent_single_token_name():
    name, email = parse_user_agent("Faadil faadil@example.com")
    assert name == "Faadil"
    assert email == "faadil@example.com"


def test_parse_user_agent_three_token_name():
    name, email = parse_user_agent("Mary Jane Smith mjs@corp.io")
    assert name == "Mary Jane Smith"
    assert email == "mjs@corp.io"


def test_parse_user_agent_email_must_contain_at():
    import pytest
    with pytest.raises(ValueError, match="email"):
        parse_user_agent("Faadil Ahmed notanemail")
