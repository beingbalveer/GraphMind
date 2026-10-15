"""LSI-020: generator request provenance extensions, bounds, and stale sources."""

import uuid

import pytest
from pydantic import ValidationError
from schemas.curriculum import RoadmapRequest
from services.roadmap.generator_request import (
    GeneratorRequestError,
    SampleTemplate,
    extend_generator_request,
    normalize_reference_url,
    resolve_sample_template,
)

PROMPT = "Learn practical backend fundamentals for real projects"


# --- Schema and backward compatibility -------------------------------------


def test_existing_minimal_request_remains_valid() -> None:
    request = RoadmapRequest(prompt=PROMPT)
    assert request.level == "beginner"
    assert request.outcome is None
    assert request.known_skills == []
    assert request.reference_url is None
    assert request.sample_template_ref is None


def test_extensions_accept_camel_case_aliases() -> None:
    request = RoadmapRequest.model_validate(
        {
            "prompt": PROMPT,
            "outcome": "Ship one typed HTTP endpoint",
            "knownSkills": ["Python functions", "HTTP basics"],
            "referenceUrl": "https://docs.python.org/3/",
            "sampleTemplateRef": "roadmap-python-backend@2026-10-14.1",
        }
    )
    assert request.outcome == "Ship one typed HTTP endpoint"
    assert request.known_skills == ["Python functions", "HTTP basics"]
    assert request.reference_url == "https://docs.python.org/3/"
    assert request.sample_template_ref == "roadmap-python-backend@2026-10-14.1"


def test_unknown_fields_are_rejected_not_dropped() -> None:
    with pytest.raises(ValidationError) as excinfo:
        RoadmapRequest.model_validate({"prompt": PROMPT, "archived": True})
    assert any(error["type"] == "extra_forbidden" for error in excinfo.value.errors())


@pytest.mark.parametrize(
    "field,value",
    [
        ("outcome", "x" * 2001),
        ("referenceUrl", "https://example.com/" + "a" * 3000),
        ("knownSkills", ["skill"] * 51),
        ("sampleTemplateRef", "x" * 101),
    ],
)
def test_extension_bounds_are_enforced(field: str, value: object) -> None:
    with pytest.raises(ValidationError):
        RoadmapRequest.model_validate({"prompt": PROMPT, field: value})


def test_blank_extension_text_is_normalized_away() -> None:
    request = RoadmapRequest(
        prompt=PROMPT, outcome="   ", reference_url="  ", sample_template_ref=" "
    )
    assert request.outcome is None
    assert request.reference_url is None
    assert request.sample_template_ref is None


def test_known_skills_are_trimmed_and_item_bounded() -> None:
    request = RoadmapRequest(prompt=PROMPT, known_skills=["  Python  ", "HTTP"])
    assert request.known_skills == ["Python", "HTTP"]
    with pytest.raises(ValidationError):
        RoadmapRequest(prompt=PROMPT, known_skills=["y" * 121])


# --- URL-bounds and existing source protections ----------------------------


@pytest.mark.parametrize(
    "url",
    [
        "ftp://example.com/doc",
        "http://localhost:5432/doc",
        "http://10.0.0.5/doc",
        "https://user:pass@example.com/doc",
        "https://example.com:8080/doc",
        "https://example.com/" + "a" * 2100,
    ],
)
def test_reference_url_rejects_blocked_bounds(url: str) -> None:
    with pytest.raises(GeneratorRequestError) as excinfo:
        normalize_reference_url(url)
    assert excinfo.value.code == "URL_BLOCKED"


def test_reference_url_is_canonicalized() -> None:
    canonical = normalize_reference_url("HTTPS://Example.com:443/path?q=1#fragment")
    assert canonical == "https://example.com/path?q=1"


def test_extend_generator_request_canonicalizes_reference_url() -> None:
    request = RoadmapRequest(prompt=PROMPT, reference_url="https://Example.com/doc/#section")
    extended = extend_generator_request(request)
    assert extended.reference_url == "https://example.com/doc/"
    assert extended.prompt == request.prompt


# --- Stale / unknown sources -----------------------------------------------


def test_approved_sample_template_resolves() -> None:
    sample = resolve_sample_template("roadmap-python-backend@2026-10-14.1")
    assert sample.id == "roadmap-python-backend"
    assert sample.snapshot_version == "2026-10-14.1"


def test_sample_template_without_version_uses_current() -> None:
    assert resolve_sample_template("roadmap-sql-queries").id == "roadmap-sql-queries"


def test_unknown_sample_template_is_rejected() -> None:
    with pytest.raises(GeneratorRequestError) as excinfo:
        resolve_sample_template("roadmap-does-not-exist")
    assert excinfo.value.code == "SAMPLE_TEMPLATE_UNKNOWN"


def test_superseded_sample_snapshot_is_stale() -> None:
    with pytest.raises(GeneratorRequestError) as excinfo:
        resolve_sample_template("roadmap-python-backend@2020-01-01.0")
    assert excinfo.value.code == "SAMPLE_TEMPLATE_STALE"


def test_malformed_sample_reference_is_rejected() -> None:
    with pytest.raises(GeneratorRequestError) as excinfo:
        resolve_sample_template("@2026-10-14.1")
    assert excinfo.value.code == "SAMPLE_TEMPLATE_INVALID"


def test_resolver_accepts_an_injected_allowlist() -> None:
    available = (SampleTemplate(id="custom-sample", snapshot_version="1.0"),)
    assert resolve_sample_template("custom-sample@1.0", available).id == "custom-sample"
    assert resolve_sample_template("custom-sample", available).snapshot_version == "1.0"
    with pytest.raises(GeneratorRequestError):
        resolve_sample_template("roadmap-python-backend", available)


# --- Persistence and the API boundary --------------------------------------


async def test_extended_fields_persist_on_the_stored_job(job_repo, job_owner) -> None:
    extended = extend_generator_request(
        RoadmapRequest(
            prompt=PROMPT,
            outcome="Ship one typed HTTP endpoint",
            known_skills=["Python functions"],
            reference_url="https://docs.python.org/3/tutorial/",
            sample_template_ref="roadmap-python-backend@2026-10-14.1",
        )
    )
    job = await job_repo.create(job_owner, extended, str(uuid.uuid4()))
    stored = (await job_repo.read(job.id, job_owner)).request
    assert stored.outcome == "Ship one typed HTTP endpoint"
    assert stored.known_skills == ["Python functions"]
    assert stored.reference_url == "https://docs.python.org/3/tutorial/"
    assert stored.sample_template_ref == "roadmap-python-backend@2026-10-14.1"


async def test_api_rejects_unknown_field(auth_client) -> None:
    response = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={"prompt": PROMPT, "archived": True},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_api_accepts_approved_extensions(auth_client) -> None:
    response = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={
            "prompt": PROMPT,
            "outcome": "Draw one observed still life",
            "knownSkills": ["Shading"],
            "referenceUrl": "https://example.com/drawing",
            "sampleTemplateRef": "roadmap-python-backend@2026-10-14.1",
        },
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    assert response.status_code == 202


async def test_api_rejects_stale_sample_template(auth_client) -> None:
    response = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={
            "prompt": PROMPT,
            "sampleTemplateRef": "roadmap-python-backend@1999-01-01.1",
        },
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SAMPLE_TEMPLATE_STALE"


async def test_api_rejects_blocked_reference_url(auth_client) -> None:
    response = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={"prompt": PROMPT, "referenceUrl": "http://localhost:8080/private"},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "URL_BLOCKED"
