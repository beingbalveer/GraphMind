"""Evaluation evidence redaction tooling (LSI-048).

Dependency-free helpers that scrub credentials and personal data from captured
provider/model run output *before* it is committed as gate evidence.

This package is evaluation tooling, not runtime code. It is exercised by the
LSI-048 runbook (`docs/integration/evidence/LSI-048.md`) and covered by
`tests/test_redact_evidence.py`. Redaction is deterministic and idempotent so a
reviewer can re-run it and get byte-identical output.
"""
