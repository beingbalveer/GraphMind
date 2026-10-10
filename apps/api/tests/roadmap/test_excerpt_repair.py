"""Unit tests for the deterministic evidenceExcerpt length auto-repair pass.

The compose/lesson stages fail when the model emits an evidenceExcerpt outside the
80-500 character bound. When pydantic validation fails only on those length issues,
the orchestrator repairs the recorded payload programmatically instead of spending
another full LLM regeneration.
"""

import json
from typing import Any

import pytest
from pydantic import ValidationError
from schemas.curriculum import CurriculumCandidate
from services.roadmap.excerpt_repair import (
    attempt_excerpt_repair,
    excerpt_length_issues,
    extract_recording_excerpt,
    is_excerpt_length_error,
    repair_payload_excerpts,
    truncate_excerpt,
)

MAX = 500
MIN = 80


def _excerpt(length: int, char: str = "e") -> str:
    return char * length


def _resource(source_id: str, excerpt: str) -> dict[str, Any]:
    return {
        "topicId": "topic_1",
        "sourceId": source_id,
        "order": 0,
        "rationale": _excerpt(20, "r"),
        "evidenceExcerpt": excerpt,
        "objectiveIndex": 0,
    }


# --- string_too_long -----------------------------------------------------------


class TestTruncateExcerpt:
    def test_truncates_to_500(self) -> None:
        value = _excerpt(600)
        repaired = truncate_excerpt(value)
        assert repaired is not None
        assert len(repaired) == MAX
        assert repaired == value[:MAX]

    def test_cuts_trailing_whitespace_first(self) -> None:
        value = _excerpt(600, "e") + "    "
        repaired = truncate_excerpt(value)
        assert repaired is not None
        assert len(repaired) == MAX
        assert not repaired.endswith(" ")

    def test_boundary_truncation_strips_leftover_whitespace(self) -> None:
        # 500 content + trailing spaces -> rstrip first shrinks below the bound.
        value = _excerpt(MAX) + "   "
        assert truncate_excerpt(value) is None  # already <= 500 after rstrip

    def test_within_bounds_returns_none(self) -> None:
        assert truncate_excerpt(_excerpt(MIN)) is None


# --- string_too_short ----------------------------------------------------------


class TestExtractRecordingExcerpt:
    def test_copies_exact_substring_when_evidence_long_enough(self) -> None:
        evidence = _excerpt(400, "a")
        excerpt = extract_recording_excerpt(evidence)
        assert excerpt is not None
        assert MIN <= len(excerpt) <= MAX
        assert excerpt == evidence[:400]  # exact verbatim slice

    def test_truncates_overlong_evidence_to_500(self) -> None:
        evidence = _excerpt(900, "a")
        excerpt = extract_recording_excerpt(evidence)
        assert excerpt is not None
        assert len(excerpt) == MAX
        assert excerpt == evidence[:MAX]

    def test_short_evidence_is_not_repairable(self) -> None:
        evidence = _excerpt(MIN - 1, "a")
        assert extract_recording_excerpt(evidence) is None

    def test_empty_evidence_is_not_repairable(self) -> None:
        assert extract_recording_excerpt("") is None


# --- error classification ------------------------------------------------------


class TestErrorClassification:
    def test_recognizes_excerpt_length_error(self) -> None:
        assert is_excerpt_length_error(
            {"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_short"}
        )
        assert is_excerpt_length_error(
            {"loc": ("resources", 0, "evidence_excerpt"), "type": "string_too_long"}
        )

    def test_rejects_non_excerpt_or_non_length_error(self) -> None:
        assert not is_excerpt_length_error(
            {"loc": ("resources", 0, "rationale"), "type": "string_too_short"}
        )
        assert not is_excerpt_length_error(
            {"loc": ("resources", 0, "evidenceExcerpt"), "type": "not_a_length_error"}
        )

    def test_only_length_issues_when_every_error_qualifies(self) -> None:
        only, indices = excerpt_length_issues(
            [
                {"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_long"},
                {"loc": ("resources", 2, "evidenceExcerpt"), "type": "string_too_short"},
            ]
        )
        assert only is True
        assert indices == {0, 2}

    def test_any_non_excerpt_error_forces_fallback(self) -> None:
        only, indices = excerpt_length_issues(
            [
                {"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_long"},
                {"loc": ("resources", 1, "rationale"), "type": "string_too_short"},
            ]
        )
        assert only is False
        assert indices == set()

    def test_empty_details_forces_fallback(self) -> None:
        assert excerpt_length_issues([]) == (False, set())


# --- payload repair ------------------------------------------------------------


class TestRepairPayload:
    def test_truncates_long_excerpt_in_payload(self) -> None:
        payload = {"resources": [_resource("s1", _excerpt(700))]}
        count = repair_payload_excerpts(payload, {}, {0})
        assert count == 1
        assert len(payload["resources"][0]["evidenceExcerpt"]) == MAX

    def test_substitutes_short_excerpt_from_recorded_evidence(self) -> None:
        evidence = _excerpt(250, "a")
        payload = {"resources": [_resource("s1", _excerpt(30, "b"))]}
        count = repair_payload_excerpts(payload, {"s1": evidence}, {0})
        assert count == 1
        assert payload["resources"][0]["evidenceExcerpt"] == evidence  # exact copy

    def test_short_excerpt_without_runnable_evidence_is_not_repaired(self) -> None:
        payload = {"resources": [_resource("s1", _excerpt(30, "b"))]}
        count = repair_payload_excerpts(payload, {"s1": _excerpt(MIN - 1)}, {0})
        assert count == 0
        assert payload["resources"][0]["evidenceExcerpt"] == _excerpt(30, "b")

    def test_short_excerpt_with_unknown_source_is_not_repaired(self) -> None:
        payload = {"resources": [_resource("missing", _excerpt(30, "b"))]}
        count = repair_payload_excerpts(payload, {"s1": _excerpt(200)}, {0})
        assert count == 0

    def test_out_of_range_index_is_skipped(self) -> None:
        payload = {"resources": [_resource("s1", _excerpt(30, "b"))]}
        assert repair_payload_excerpts(payload, {"s1": _excerpt(200)}, {5}) == 0

    def test_only_touches_named_offenders(self) -> None:
        evidence = _excerpt(200, "a")
        payload = {
            "resources": [_resource("s1", _excerpt(30, "b")), _resource("s1", _excerpt(900))]
        }
        count = repair_payload_excerpts(payload, {"s1": evidence}, {0})
        assert count == 1
        assert payload["resources"][0]["evidenceExcerpt"] == evidence
        # index 1 untouched
        assert len(payload["resources"][1]["evidenceExcerpt"]) == 900


# --- decision (falls through vs retry) -----------------------------------------


class TestAttemptRepair:
    def test_long_excerpt_round_trip(self) -> None:
        payload = {"resources": [_resource("s1", _excerpt(700))]}
        should_retry, repaired = attempt_excerpt_repair(
            payload, {}, [{"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_long"}]
        )
        assert should_retry is True
        assert repaired == 1
        assert len(payload["resources"][0]["evidenceExcerpt"]) == MAX

    def test_short_excerpt_round_trip_from_evidence(self) -> None:
        evidence = _excerpt(300, "a")
        payload = {"resources": [_resource("s1", _excerpt(10, "b"))]}
        should_retry, repaired = attempt_excerpt_repair(
            payload,
            {"s1": evidence},
            [{"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_short"}],
        )
        assert should_retry is True
        assert repaired == 1
        assert payload["resources"][0]["evidenceExcerpt"] == evidence

    def test_short_excerpt_without_runnable_evidence_falls_through(self) -> None:
        errors: list[dict[str, Any]] = [
            {"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_short"}
        ]
        payload = {"resources": [_resource("s1", _excerpt(10, "b"))]}
        should_retry, repaired = attempt_excerpt_repair(
            payload, {"s1": _excerpt(MIN - 1, "a")}, errors
        )
        assert should_retry is False
        assert repaired == 0

    def test_mixed_with_unrelated_error_falls_through(self) -> None:
        errors: list[dict[str, Any]] = [
            {"loc": ("resources", 0, "evidenceExcerpt"), "type": "string_too_short"},
            {"loc": ("resources", 0, "rationale"), "type": "string_too_short"},
        ]
        payload = {"resources": [_resource("s1", _excerpt(10, "b"))]}
        should_retry, repaired = attempt_excerpt_repair(payload, {"s1": _excerpt(100, "a")}, errors)
        assert should_retry is False
        assert repaired == 0


# --- end-to-end revalidation against the real schema --------------------------


class TestSchemaRevalidation:
    def _candidate_payload(self, excerpts: list[str]) -> dict[str, Any]:
        return {
            "title": "title",
            "outcome": _excerpt(5, "o"),
            "assumptions": [],
            "items": [
                {
                    "id": "topic_1",
                    "kind": "topic",
                    "title": "Title",
                    "brief": _excerpt(10, "x"),
                    "objectives": ["objective one"],
                    "exercise": "exercise",
                    "format": "practice",
                    "order": 0,
                    "participation": "active",
                    "estimateMinutes": 30,
                }
            ],
            "resources": [_resource("s1", excerpt) for excerpt in excerpts],
        }

    def test_overlong_excerpt_repairs_and_revalidates(self) -> None:
        evidence = _excerpt(600, "a")
        payload = self._candidate_payload([_excerpt(600, "b"), _excerpt(600, "c")])
        with pytest.raises(ValidationError) as exc:
            CurriculumCandidate.model_validate(json.loads(json.dumps(payload)))
        errors = exc.value.errors(include_input=False, include_context=False)
        only, offending = excerpt_length_issues(errors)
        assert only is True and offending == {0, 1}

        sources = {"s1": evidence}
        should_retry, _ = attempt_excerpt_repair(payload, sources, errors)
        assert should_retry is True
        candidate = CurriculumCandidate.model_validate(json.loads(json.dumps(payload)))
        assert {len(r.evidence_excerpt) for r in candidate.resources} == {MAX}

    def test_short_excerpt_repairs_from_recorded_evidence_and_revalidates(self) -> None:
        evidence = (
            "The quick brown fox jumps over the lazy dog with great ease and "
            "precision every single day. " * 8
        )  # length well over 80
        assert len(evidence) >= MIN
        payload = self._candidate_payload([_excerpt(5, "z")])
        with pytest.raises(ValidationError) as exc:
            CurriculumCandidate.model_validate(json.loads(json.dumps(payload)))
        errors = exc.value.errors(include_input=False, include_context=False)
        only, offending = excerpt_length_issues(errors)
        assert only is True and offending == {0}

        should_retry, _ = attempt_excerpt_repair(payload, {"s1": evidence}, errors)
        assert should_retry is True
        candidate = CurriculumCandidate.model_validate(json.loads(json.dumps(payload)))
        repaired = candidate.resources[0].evidence_excerpt
        assert MIN <= len(repaired) <= MAX
        # The repaired excerpt is a verbatim slice of the recorded evidence.
        assert repaired in evidence
