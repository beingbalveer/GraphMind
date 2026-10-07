import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.auth_service import create_access_token


async def test_missing_auth_is_401_even_under_pytest():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.post(
            "/api/v1/roadmap/jobs",
            json={"prompt": "Learn practical drawing"},
            headers={"Idempotency-Key": str(uuid.uuid4())},
        )
    assert result.status_code == 401


async def test_create_is_idempotent_private_and_requires_uuid(auth_client):
    key = str(uuid.uuid4())
    data = {"prompt": "Learn practical drawing", "background": "private confidential history"}
    first = await auth_client.post(
        "/api/v1/roadmap/jobs", json=data, headers={"Idempotency-Key": key}
    )
    second = await auth_client.post(
        "/api/v1/roadmap/jobs", json=data, headers={"Idempotency-Key": key}
    )
    assert first.status_code == second.status_code == 202
    assert first.json()["id"] == second.json()["id"]
    assert "checkpoint" not in first.json() and "ownerId" not in first.json()
    assert "private confidential history" not in first.text
    invalid = await auth_client.post(
        "/api/v1/roadmap/jobs", json=data, headers={"Idempotency-Key": "invalid"}
    )
    assert invalid.status_code == 422
    changed = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={"prompt": "Learn piano technique"},
        headers={"Idempotency-Key": key},
    )
    assert changed.status_code == 409 and changed.json()["error"]["code"] == "IDEMPOTENCY_MISMATCH"


@pytest.mark.parametrize(
    "suffix,method",
    [
        ("", "get"),
        ("/events", "get"),
        ("/references", "get"),
        ("/start", "post"),
        ("/cancel", "post"),
        ("/retry", "post"),
        ("/answers", "post"),
    ],
)
async def test_other_owner_cannot_access_job(worker_job, suffix, method):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token("usr_default_admin")},
    ) as client:
        result = await getattr(client, method)(
            f"/api/v1/roadmap/jobs/{worker_job.id}{suffix}",
            **({"json": {"questionId": "q", "answer": "Beginner"}} if suffix == "/answers" else {}),
        )
    assert result.status_code == 404


async def test_owner_lifecycle_and_references(auth_client, tmp_path, monkeypatch):
    from config import get_settings

    monkeypatch.setattr(get_settings(), "ROADMAP_REFERENCE_DIR", str(tmp_path))
    created = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={"prompt": "Learn drawing fundamentals"},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    job_id = created.json()["id"]
    file = await auth_client.post(
        f"/api/v1/roadmap/jobs/{job_id}/references",
        files={"file": ("notes.txt", b"Practice line control", "text/plain")},
    )
    assert file.status_code == 201 and file.json()["status"] == "inspected"
    assert "storagePath" not in file.text
    link = await auth_client.post(
        f"/api/v1/roadmap/jobs/{job_id}/references", json={"url": "https://example.com/drawing"}
    )
    assert link.status_code == 201
    refs = await auth_client.get(f"/api/v1/roadmap/jobs/{job_id}/references")
    assert len(refs.json()) == 2
    # worker_job already reserves this owner's active slot.
    start = await auth_client.post(f"/api/v1/roadmap/jobs/{job_id}/start")
    assert start.status_code == 409
    canceled = await auth_client.post(f"/api/v1/roadmap/jobs/{job_id}/cancel")
    assert canceled.json()["status"] == "canceled"
    read = await auth_client.get(f"/api/v1/roadmap/jobs/{job_id}")
    listed = await auth_client.get("/api/v1/roadmap/jobs")
    assert read.status_code == 200 and any(j["id"] == job_id for j in listed.json())


async def test_validation_logs_never_include_private_input(auth_client, caplog, monkeypatch):
    from unittest.mock import Mock

    import errors

    logger = Mock()
    monkeypatch.setattr(errors, "logger", logger)
    result = await auth_client.post(
        "/api/v1/roadmap/jobs",
        json={"prompt": "private", "background": "confidential payroll detail"},
        headers={"Idempotency-Key": str(uuid.uuid4())},
    )
    assert result.status_code == 422
    assert "confidential payroll detail" not in str(logger.warning.call_args)
    assert "input" not in result.json()["error"].get("details", [{}])[0]


async def test_legacy_generation_failure_never_returns_generic_fallback(auth_client, monkeypatch):
    from types import SimpleNamespace
    from unittest.mock import AsyncMock

    monkeypatch.setattr(
        "services.roadmap_service.get_provider",
        lambda *args, **kwargs: SimpleNamespace(
            generate=AsyncMock(side_effect=RuntimeError("unavailable"))
        ),
    )
    result = await auth_client.post(
        "/api/v1/roadmap/generate", json={"goal": "Learn watercolor painting"}
    )
    assert result.status_code == 502
    assert result.json()["error"]["code"] == "GENERATION_UNAVAILABLE"


async def test_empty_bearer_never_uses_test_admin_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get("/api/v1/roadmap/jobs", headers={"Authorization": "Bearer "})
    assert result.status_code == 401
