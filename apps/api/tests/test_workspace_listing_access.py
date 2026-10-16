"""LSI-046 gate: workspace listing must never leak across tenants.

Closes the review finding that ``GET /api/v1/workspaces`` used
``get_optional_user`` and returned *every* tenant's workspace metadata to an
anonymous/invalid caller. The routes now require authentication, and the
service refuses to list anything without an identity as defense in depth.

All backend tests use the isolated ``graphmind_test`` database, never live data.
"""

import uuid

import pytest
from database import get_session_factory
from httpx import ASGITransport, AsyncClient
from main import app
from services.workspace_service import WorkspaceService


def _unique_email(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


def _client(*, token: str | None = None) -> AsyncClient:
    cookies = {"access_token": token} if token else {}
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", cookies=cookies)


@pytest.mark.asyncio
async def test_workspace_collection_requires_valid_authentication() -> None:
    """An unverifiable credential is rejected, never silently downgraded.

    With the old optional-user dependency an invalid token became ``None`` and
    the listing returned every tenant's rows; requiring authentication makes the
    same request a hard ``401``.
    """
    async with _client(token="not-a-valid-token") as client:
        listing = await client.get("/api/v1/workspaces")
        create = await client.post("/api/v1/workspaces", json={"name": "Should not exist"})
        seed = await client.post("/api/v1/workspaces/seed")

    assert listing.status_code == 401
    assert create.status_code == 401
    assert seed.status_code == 401


@pytest.mark.asyncio
async def test_service_listing_without_identity_returns_no_workspaces() -> None:
    """The service returns an empty authorized collection, never all rows."""
    factory = get_session_factory()
    async with factory() as session:
        workspaces, total = await WorkspaceService.list_workspaces(session, user_id=None)

    assert workspaces == []
    assert total == 0


@pytest.mark.asyncio
async def test_listing_is_scoped_to_the_authenticated_user() -> None:
    async with _client() as owner:
        await owner.post(
            "/api/v1/auth/register",
            json={"email": _unique_email("listing_owner"), "password": "PasswordStrong123!"},
        )
        created = await owner.post("/api/v1/workspaces", json={"name": "Owner Private Vault"})
        assert created.status_code == 201
        owned_id = created.json()["id"]

        own_listing = await owner.get("/api/v1/workspaces")
        assert own_listing.status_code == 200
        assert any(ws["id"] == owned_id for ws in own_listing.json()["workspaces"])

        async with _client() as stranger:
            await stranger.post(
                "/api/v1/auth/register",
                json={"email": _unique_email("listing_stranger"), "password": "PasswordStrong123!"},
            )
            stranger_listing = await stranger.get("/api/v1/workspaces")

        assert stranger_listing.status_code == 200
        assert all(ws["id"] != owned_id for ws in stranger_listing.json()["workspaces"])
