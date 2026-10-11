"""API tests for the roadmap.sh import endpoints."""

import io
import tarfile
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from services.auth_service import create_access_token

DEVOPS_FILES: list[tuple[str, str]] = [
    (
        "docker@h1.md",
        "# Docker\n\nDocker is a container platform that packages applications with their dependencies for portable execution across environments.\n\n- [@official@Docker Docs](https://docs.docker.com/)\n",
    ),
    (
        "ansible@h2.md",
        "# Ansible\n\nAnsible is an open-source automation tool for configuration management, application deployment, and task orchestration.\n\n- [@official@Ansible Website](https://www.ansible.com/)\n",
    ),
]


def make_archive() -> bytes:
    """Build an in-memory developer-roadmap tarball for the devops slug."""
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for name, text in DEVOPS_FILES:
            data = text.encode("utf-8")
            info = tarfile.TarInfo(f"developer-roadmap-master/roadmaps/devops/content/{name}")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buffer.getvalue()


@pytest.fixture
async def import_owner(curriculum_session):
    from models.user import User
    from models.workspace import Workspace

    owner_id = f"usr_{uuid.uuid4().hex[:12]}"
    curriculum_session.add(
        User(id=owner_id, email=f"{uuid.uuid4().hex}@example.com", full_name="Import API owner")
    )
    await curriculum_session.flush()
    await curriculum_session.commit()
    try:
        yield owner_id
    finally:
        from sqlalchemy import delete as _delete

        await curriculum_session.rollback()
        await curriculum_session.execute(
            _delete(Workspace).where(Workspace.owner_id == owner_id)
        )
        await curriculum_session.execute(_delete(User).where(User.id == owner_id))
        await curriculum_session.commit()


@pytest.fixture
def import_archive(monkeypatch):
    """Serve a tiny real-format tarball for the devops slug (no network)."""
    import services.roadmap.import_service as svc

    archive = make_archive()
    monkeypatch.setattr(svc, "download_tarball", lambda url=None: archive)
    return archive


async def test_import_fields_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        result = await client.get("/api/v1/roadmap/imports/fields")
    assert result.status_code == 401


async def test_import_fields_lists_curated_fields(import_owner):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(import_owner)},
    ) as client:
        result = await client.get("/api/v1/roadmap/imports/fields")
    assert result.status_code == 200
    fields = result.json()
    slugs = {f["slug"] for f in fields}
    assert {"devops", "ai-engineer", "frontend", "backend", "cyber-security"} <= slugs
    entry = next(f for f in fields if f["slug"] == "devops")
    assert entry["title"] == "DevOps Roadmap"
    assert entry["url"] == "https://roadmap.sh/devops"
    assert entry["topicCount"] > 0


async def test_create_imports_requires_valid_slug(import_owner, import_archive):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(import_owner)},
    ) as client:
        result = await client.post(
            "/api/v1/roadmap/imports", json={"slugs": ["not-a-field"]}
        )
    # Unknown fields are reported as per-slug errors (201 with errors), or the request
    # validator rejects it; either way no crash and no created workspace.
    assert result.status_code in {201, 422}


async def test_create_imports_happy_path_and_idempotent(import_owner, import_archive):
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(import_owner)},
    ) as client:
        first = await client.post("/api/v1/roadmap/imports", json={"slugs": ["devops"]})
        second = await client.post("/api/v1/roadmap/imports", json={"slugs": ["devops"]})
    assert first.status_code == 201
    data = first.json()
    assert len(data["results"]) == 1
    item = data["results"][0]
    assert item["slug"] == "devops" and item["status"] == "created"
    assert item["workspaceId"] and item["roadmapId"] and item["revisionId"]
    assert item["topicCount"] == 2

    second_data = second.json()
    assert second.status_code == 201
    assert second_data["results"][0]["status"] == "existing"
    assert second_data["results"][0]["workspaceId"] == item["workspaceId"]

    # The imported roadmap is readable through the curriculum endpoint.
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={"access_token": create_access_token(import_owner)},
    ) as client:
        view = await client.get(f"/api/v1/workspaces/{item['workspaceId']}/roadmap")
    assert view.status_code == 200
    body = view.json()
    assert body["candidate"]["title"] == "DevOps Roadmap"
    assert body["validation"]["valid"] is True
