"""Optional generator request extensions: references, samples, and provenance.

These fields extend the existing ``RoadmapRequest`` additively for the Learning
Studio generator (LSI-020). Unknown fields are already rejected by the schema
(``extra="forbid"``); this module adds the semantic checks the schema cannot
express without importing the source safeguards:

* one optional reference URL, normalized with the existing public-source
  protections (scheme/host/port allowlist plus a 2048-character bound), and
* one optional approved sample-template snapshot reference, rejected loudly
  when it is unknown or superseded instead of being dropped silently.

Public snapshot storage is introduced by LSI-025. Until then the approved
sample snapshots are curated here; LSI-025 replaces this allowlist with the
published snapshot table without changing the request contract.
"""

from dataclasses import dataclass

from schemas.curriculum import RoadmapRequest
from services.roadmap.source_fetcher import SourceFetchError, canonical_source_url

MAX_REFERENCE_URL_LENGTH = 2048


class GeneratorRequestError(ValueError):
    """A request extension failed semantic validation; never dropped silently."""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class SampleTemplate:
    id: str
    snapshot_version: str


# Approved curated preview samples. These mirror the published prototype
# snapshots approved in LSI-001/LSI-002. A request may seed only from these.
CURATED_SAMPLE_TEMPLATES: tuple[SampleTemplate, ...] = (
    SampleTemplate(id="roadmap-python-backend", snapshot_version="2026-10-14.1"),
    SampleTemplate(id="roadmap-web-accessibility", snapshot_version="2026-10-14.1"),
    SampleTemplate(id="roadmap-sql-queries", snapshot_version="2026-10-14.1"),
)


def available_sample_templates() -> tuple[SampleTemplate, ...]:
    return CURATED_SAMPLE_TEMPLATES


def resolve_sample_template(
    ref: str, available: tuple[SampleTemplate, ...] | None = None
) -> SampleTemplate:
    """Resolve ``ref`` (``template_id`` or ``template_id@snapshot_version``).

    Raises :class:`GeneratorRequestError` for malformed, unknown, or stale
    references so a caller can never silently ignore an unsupported sample.
    """
    value = ref.strip()
    template_id, _, version = value.partition("@")
    if not template_id or template_id != template_id.strip() or " " in template_id:
        raise GeneratorRequestError(
            "SAMPLE_TEMPLATE_INVALID", "Provide a valid sample template reference"
        )
    known = available if available is not None else available_sample_templates()
    matches = [template for template in known if template.id == template_id]
    if not matches:
        raise GeneratorRequestError(
            "SAMPLE_TEMPLATE_UNKNOWN", "This sample template is not available"
        )
    if version and all(template.snapshot_version != version for template in matches):
        raise GeneratorRequestError(
            "SAMPLE_TEMPLATE_STALE", "Template snapshot version is obsolete"
        )
    return matches[0]


def normalize_reference_url(url: str) -> str:
    """Canonicalize one optional reference URL using existing source protections."""
    try:
        canonical = canonical_source_url(url)
    except SourceFetchError as error:
        raise GeneratorRequestError(error.code, str(error)) from None
    if len(canonical) > MAX_REFERENCE_URL_LENGTH:
        raise GeneratorRequestError("URL_BLOCKED", "Keep reference URLs within 2048 characters")
    return canonical


def extend_generator_request(
    request: RoadmapRequest, available: tuple[SampleTemplate, ...] | None = None
) -> RoadmapRequest:
    """Validate and normalize the optional extensions, returning the stored request."""
    updates: dict[str, object] = {}
    if request.reference_url:
        updates["reference_url"] = normalize_reference_url(request.reference_url)
    if request.sample_template_ref:
        resolve_sample_template(request.sample_template_ref, available)
    return request.model_copy(update=updates) if updates else request
