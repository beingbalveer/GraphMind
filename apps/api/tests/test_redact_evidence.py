"""Tests for the LSI-048 evidence redaction tooling (`evaluation.redact`)."""

import io
import json

from evaluation.redact import REDACTED, main, redact_evidence, redact_json

GOOGLE_KEY = "AIza" + "A" * 35
OPENAI_KEY = "sk-" + "B" * 24
GITHUB_TOKEN = "ghp_" + "C" * 36
SLACK_TOKEN = "xoxb-1234567890-abcdefghij"
JWT = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcDEF123_-signature"


def test_redacts_credential_shaped_tokens() -> None:
    text = (
        f"provider=gemini key={GOOGLE_KEY}\n"
        f"openai={OPENAI_KEY}\n"
        f"github={GITHUB_TOKEN}\n"
        f"slack={SLACK_TOKEN}\n"
        f"jwt={JWT}\n"
    )
    out = redact_evidence(text)

    for secret in (GOOGLE_KEY, OPENAI_KEY, GITHUB_TOKEN, SLACK_TOKEN, JWT):
        assert secret not in out
    assert out.count(REDACTED) >= 5
    assert "provider=gemini" in out


def test_redacts_bearer_and_inline_secret_values() -> None:
    text = (
        "Authorization: Bearer abc.def-123\n"
        '{"api_key": "sk-live-abcdefghijklmnopqrst", "model": "gemini-2.5-flash"}'
    )
    out = redact_evidence(text)

    assert "abc.def-123" not in out
    assert "sk-live-abcdefghijklmnopqrst" not in out
    assert out.count(REDACTED) >= 2
    assert '"model": "gemini-2.5-flash"' in out


def test_redacts_email_local_part_only() -> None:
    assert redact_evidence("learner@example.com") == "l***@example.com"
    assert "graphmind.example.org" in redact_evidence("ops.team+ci@graphmind.example.org")


def test_preserves_benign_evidence_content() -> None:
    text = (
        "grounding coverage 82% across 5 sources\n"
        "node 7f3c2b1a-4d5e-6f70-8192-a3b4c5d6e7f8\n"
        'usage {"prompt_tokens": 1234, "token_count": 42}\n'
        "https://fastapi.tiangolo.com/tutorial/\n"
        "cancel requested after 3s; recovery replay completed\n"
    )
    out = redact_evidence(text)

    assert "82%" in out
    assert "7f3c2b1a-4d5e-6f70-8192-a3b4c5d6e7f8" in out
    assert '"prompt_tokens": 1234' in out
    assert '"token_count": 42' in out
    assert "https://fastapi.tiangolo.com/tutorial/" in out


def test_redaction_is_idempotent() -> None:
    text = (
        f"key={GOOGLE_KEY} bearer=Bearer {JWT} mail=user@example.com "
        f'{{"api_key": "{OPENAI_KEY}"}}'
    )
    once = redact_evidence(text)
    assert redact_evidence(once) == once


def test_redact_json_by_key_name_and_string_value() -> None:
    payload = {
        "provider": "gemini",
        "model": "gemini-2.5-flash",
        "token_count": 42,
        "api_key": OPENAI_KEY,
        "nested": {"authorization": "Bearer secret-token-value", "count": 3},
        "log": f"grounding ok; leaked {GOOGLE_KEY}",
        "items": [{"client_secret": "shh"}, "plain prompt"],
    }
    out = redact_json(payload)

    assert out["provider"] == "gemini"
    assert out["token_count"] == 42
    assert out["api_key"] == REDACTED
    assert out["nested"]["authorization"] == REDACTED
    assert out["nested"]["count"] == 3
    assert GOOGLE_KEY not in out["log"]
    assert out["items"][0]["client_secret"] == REDACTED
    assert out["items"][1] == "plain prompt"


def test_cli_redacts_non_json_file(tmp_path, capsys) -> None:
    path = tmp_path / "capture.log"
    path.write_text(f"provider=openai key={OPENAI_KEY}\n", encoding="utf-8")

    assert main([str(path)]) == 0
    assert OPENAI_KEY not in capsys.readouterr().out


def test_cli_redacts_json_stdin(monkeypatch, capsys) -> None:
    monkeypatch.setattr(
        "sys.stdin",
        io.StringIO(json.dumps({"api_key": OPENAI_KEY, "ok": True})),
    )

    assert main([]) == 0
    out = json.loads(capsys.readouterr().out)
    assert out["api_key"] == REDACTED
    assert out["ok"] is True
