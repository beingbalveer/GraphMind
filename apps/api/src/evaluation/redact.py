"""Redact credentials and personal data from captured evaluation evidence.

Pure functions with no runtime dependencies. Usage:

    python -m evaluation.redact captured.json > captured.redacted.json
    cat captured.log | python -m evaluation.redact

`redact_evidence` handles free-form text/logs. `redact_json` handles parsed
JSON, additionally dropping values whose *key name* is a known secret name
(e.g. ``"api_key": "..."``). Both are idempotent.
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any

REDACTED = "[REDACTED]"

# Credential-shaped tokens found anywhere in free text.
_TOKEN_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Google API keys: "AIza" + 35 URL-safe characters.
    re.compile(r"AIza[0-9A-Za-z_\-]{35}"),
    # OpenAI keys: "sk-", "sk-proj-", "sk-svcacct-".
    re.compile(r"sk-(?:proj-|svcacct-)?[A-Za-z0-9_\-]{20,}"),
    # GitHub tokens.
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    # Slack tokens.
    re.compile(r"xox[baprs]-[A-Za-z0-9-]{10,}"),
    # JSON Web Tokens.
    re.compile(r"eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+"),
)

# "Authorization: Bearer <token>" / "bearer <token>".
_BEARER = re.compile(r"\bBearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE)

# Inline `api_key` / `secret` / `token` assignments in JSON or query strings.
# The value stops at a quote, whitespace, comma, or object close; an optional
# `Bearer ` prefix is consumed so `authorization: bearer <token>` redacts whole.
_INLINE_SECRET = re.compile(
    r"(?P<label>[\"']?(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token"
    r"|secret[_-]?key|client[_-]?secret|authorization|x-api-key)[\"']?"
    r"\s*[:=]\s*[\"']?)"
    r"(?P<value>(?:Bearer\s+)?[^\"'\s,}]+)",
    re.IGNORECASE,
)

# Email addresses: keep the domain, redact the local part.
_EMAIL = re.compile(r"(?P<local>[A-Za-z0-9._%+\-]+)@(?P<domain>[A-Za-z0-9.\-]+\.[A-Za-z]{2,})")

# Exact JSON keys whose value is always a secret. Anchored so that legitimate
# metrics such as ``token_count`` / ``prompt_tokens`` are preserved.
_SECRET_KEY = re.compile(
    r"^(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token"
    r"|secret[_-]?key|client[_-]?secret|authorization|password|credential)$",
    re.IGNORECASE,
)


def _redact_email(match: re.Match[str]) -> str:
    local = match.group("local")
    return f"{local[0]}***@{match.group('domain')}"


def _redact_inline(match: re.Match[str]) -> str:
    return f"{match.group('label')}{REDACTED}"


def redact_evidence(text: str) -> str:
    """Return ``text`` with credentials and personal data replaced by markers."""
    redacted = text
    for pattern in _TOKEN_PATTERNS:
        redacted = pattern.sub(REDACTED, redacted)
    redacted = _BEARER.sub(f"Bearer {REDACTED}", redacted)
    redacted = _INLINE_SECRET.sub(_redact_inline, redacted)
    redacted = _EMAIL.sub(_redact_email, redacted)
    return redacted


def redact_json(value: Any) -> Any:
    """Recursively redact a parsed JSON value.

    Values under a secret-named key are replaced outright; every other string is
    passed through :func:`redact_evidence`. Containers are rebuilt.
    """
    if isinstance(value, dict):
        out: dict[Any, Any] = {}
        for key, item in value.items():
            if isinstance(key, str) and _SECRET_KEY.match(key):
                out[key] = REDACTED
            else:
                out[key] = redact_json(item)
        return out
    if isinstance(value, list):
        return [redact_json(item) for item in value]
    if isinstance(value, str):
        return redact_evidence(value)
    return value


def main(argv: list[str] | None = None) -> int:
    """Read a file (or stdin), redact it, and write the result to stdout."""
    args = sys.argv[1:] if argv is None else argv
    if args:
        with open(args[0], encoding="utf-8") as handle:
            data = handle.read()
    else:
        data = sys.stdin.read()

    try:
        parsed = json.loads(data)
    except json.JSONDecodeError:
        sys.stdout.write(redact_evidence(data))
        return 0

    sys.stdout.write(json.dumps(redact_json(parsed), indent=2, ensure_ascii=False))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
