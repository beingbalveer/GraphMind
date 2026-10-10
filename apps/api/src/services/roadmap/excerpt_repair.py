"""Programmatic pre-validation repair for evidenceExcerpt length violations.

Stage outputs (CurriculumCandidate, TopicBatch) carry ``evidenceExcerpt`` fields that
must be an exact 80-500 character copy of the recorded source evidence. When schema
validation fails *only* on those length bounds (``string_too_short`` /
``string_too_long``), the orchestrator repairs the recorded payload deterministically
instead of spending another full LLM regeneration:

* too long -> truncate to 500 characters (trailing whitespace cut first);
* too short -> copy an exact 80-500 character substring from the matching recorded
  source evidence (never inventing text);

then re-validates. If the repaired payload is still invalid it falls through to the
normal regeneration path unchanged. The 80-500 schema bounds are never changed here.
"""

from __future__ import annotations

from typing import Any

_MIN_EXCERPT = 80
_MAX_EXCERPT = 500

# Pydantic reports ``loc`` using the python field name, but the source payload we
# parse and repair uses the camelCase alias the schema advertises. Accept both.
_EXCERPT_FIELDS = {"evidence_excerpt", "evidenceExcerpt"}
_LENGTH_ERROR_TYPES = {"string_too_short", "string_too_long"}
_RESOURCE_LIST_KEYS = {"resources"}


def is_excerpt_length_error(detail: Any) -> bool:
    """True when a single pydantic error is an evidenceExcerpt length violation."""
    loc = detail.get("loc", ())
    return (
        isinstance(loc, (tuple, list))
        and len(loc) >= 2
        and str(loc[-1]) in _EXCERPT_FIELDS
        and detail.get("type") in _LENGTH_ERROR_TYPES
    )


def excerpt_length_issues(details: list[Any]) -> tuple[bool, set[int]]:
    """Classify a validation failure.

    Returns ``(True, offending_resource_indices)`` when EVERY reported error is an
    evidenceExcerpt length violation located under a ``resources`` list, and the
    resource index can be recovered from each error's ``loc``. Any unrelated error,
    or an excerpt error not directly under a resource list, yields ``(False, set())``
    so the caller falls through to the normal regeneration path.
    """
    if not details:
        return False, set()
    indices: set[int] = set()
    for detail in details:
        if not is_excerpt_length_error(detail):
            return False, set()
        loc = detail.get("loc", ())
        if not isinstance(loc, (tuple, list)) or len(loc) < 2:
            return False, set()
        if str(loc[0]) not in _RESOURCE_LIST_KEYS:
            return False, set()
        index = loc[1]
        if not isinstance(index, int):
            return False, set()
        indices.add(index)
    return True, indices


def truncate_excerpt(value: str) -> str | None:
    """Fix a ``string_too_long`` excerpt.

    Cut trailing whitespace first, then truncate to 500 characters and cut any
    trailing whitespace left over from the boundary. Returns ``None`` when the value
    is actually under the upper bound already (nothing to fix here).
    """
    if not isinstance(value, str):
        return None
    stripped = value.rstrip()
    if len(stripped) <= _MAX_EXCERPT:
        return None
    return stripped[:_MAX_EXCERPT].rstrip()


def extract_recording_excerpt(evidence: str) -> str | None:
    """Fix a ``string_too_short`` excerpt from recorded evidence.

    Copies an exact ``min(len, 500)``-character substring of the recorded source
    evidence, only when that evidence can supply a run of at least 80 characters.
    The substring is a verbatim slice, so it still matches later grounding checks.
    Returns ``None`` when the recorded excerpt cannot supply a >=80-char run.
    """
    if not isinstance(evidence, str) or len(evidence) < _MIN_EXCERPT:
        return None
    return evidence[:_MAX_EXCERPT]


def _resource_field(resource: dict[str, Any], *names: str) -> Any:
    for name in names:
        if name in resource:
            return resource[name]
    return None


def repair_payload_excerpts(
    payload: dict[str, Any], sources: dict[str, str], offending: set[int]
) -> int:
    """Repair evidenceExcerpt length violations in ``payload["resources"]`` in place.

    ``sources`` maps a canonical source id to its recorded evidence string. Only the
    resources whose list index is in ``offending`` are touched. Returns the number of
    excerpts actually repaired.
    """
    resources = payload.get("resources") if isinstance(payload, dict) else None
    if not isinstance(resources, list):
        return 0
    fixed = 0
    for index in sorted(offending):
        if index >= len(resources):
            continue
        resource = resources[index]
        if not isinstance(resource, dict):
            continue
        excerpt = _resource_field(resource, "evidenceExcerpt", "evidence_excerpt")
        if not isinstance(excerpt, str) or not excerpt:
            continue
        field = "evidenceExcerpt" if "evidenceExcerpt" in resource else "evidence_excerpt"
        if len(excerpt) > _MAX_EXCERPT:
            repaired = truncate_excerpt(excerpt)
        elif len(excerpt) >= _MIN_EXCERPT:
            # Not actually a length problem (defensive if a stale index was reused).
            continue
        else:
            source_id = _resource_field(resource, "sourceId", "source_id")
            evidence = sources.get(source_id) if isinstance(source_id, str) else None
            repaired = extract_recording_excerpt(evidence) if evidence else None
        if repaired is not None:
            resource[field] = repaired
            fixed += 1
    return fixed


def attempt_excerpt_repair(
    payload: dict[str, Any], sources: dict[str, str], errors: list[Any]
) -> tuple[bool, int]:
    """Decide and perform the programmatic excerpt repair.

    Returns ``(should_retry_raw, repaired_count)``. ``should_retry_raw`` is True only
    when every reported error was an evidenceExcerpt length violation and at least one
    excerpt was actually repaired (so the caller should re-validate the repaired
    payload). A False return means the caller should use the existing LLM
    regeneration path unchanged.
    """
    only_lengths, offending = excerpt_length_issues(errors)
    if not only_lengths or not offending:
        return False, 0
    repaired = repair_payload_excerpts(payload, sources, offending)
    return repaired > 0, repaired
