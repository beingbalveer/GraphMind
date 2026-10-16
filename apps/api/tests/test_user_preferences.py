import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


def _unique_email(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


async def _register(client: AsyncClient, prefix: str) -> None:
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": _unique_email(prefix), "password": "PasswordStrong123!"},
    )
    assert resp.status_code in (200, 201)


@pytest.mark.asyncio
async def test_get_preferences_returns_and_persists_defaults() -> None:
    """A first read materializes the approved defaults for the account."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _register(client, "prefs_defaults")

        resp = await client.get("/api/v1/users/me/preferences")
        assert resp.status_code == 200
        data = resp.json()
        assert data["theme"] == "system"
        assert data["readingFontSize"] == "md"
        assert data["reducedMotion"] is False
        assert data["defaultStudyHours"] == 4.0
        assert data["tutorStyle"] == "socratic"
        assert data["version"] == 1
        assert data["updatedAt"]

        # Second read is stable (defaults persisted, not re-generated).
        again = await client.get("/api/v1/users/me/preferences")
        assert again.json()["version"] == 1


@pytest.mark.asyncio
async def test_update_preferences_persists_across_reload_and_bumps_version() -> None:
    """An update survives a fresh request/session and increments the version."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _register(client, "prefs_update")

        initial = (await client.get("/api/v1/users/me/preferences")).json()
        resp = await client.put(
            "/api/v1/users/me/preferences",
            json={
                "theme": "dark",
                "readingFontSize": "lg",
                "reducedMotion": True,
                "defaultStudyHours": 6.5,
                "tutorStyle": "concise",
                "version": initial["version"],
            },
        )
        assert resp.status_code == 200
        updated = resp.json()
        assert updated["theme"] == "dark"
        assert updated["readingFontSize"] == "lg"
        assert updated["reducedMotion"] is True
        assert updated["defaultStudyHours"] == 6.5
        assert updated["tutorStyle"] == "concise"
        assert updated["version"] == initial["version"] + 1

        # Re-read (fresh request) proves persistence.
        reloaded = (await client.get("/api/v1/users/me/preferences")).json()
        assert reloaded["theme"] == "dark"
        assert reloaded["tutorStyle"] == "concise"
        assert reloaded["version"] == updated["version"]


@pytest.mark.asyncio
async def test_stale_version_is_rejected_with_conflict() -> None:
    """A concurrent writer using a stale version receives 409, not a silent clobber."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _register(client, "prefs_conflict")
        start = (await client.get("/api/v1/users/me/preferences")).json()

        first = await client.put(
            "/api/v1/users/me/preferences",
            json={"theme": "dark", "version": start["version"]},
        )
        assert first.status_code == 200

        stale = await client.put(
            "/api/v1/users/me/preferences",
            json={"theme": "light", "version": start["version"]},
        )
        assert stale.status_code == 409

        current = (await client.get("/api/v1/users/me/preferences")).json()
        assert current["theme"] == "dark"
        assert current["version"] == start["version"] + 1


@pytest.mark.asyncio
async def test_preferences_are_scoped_to_the_owning_account() -> None:
    """One account's preference update never affects another account."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as user_a:
        await _register(user_a, "prefs_owner_a")
        await user_a.put(
            "/api/v1/users/me/preferences",
            json={"theme": "dark", "tutorStyle": "detailed"},
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as user_b:
            await _register(user_b, "prefs_owner_b")
            prefs_b = (await user_b.get("/api/v1/users/me/preferences")).json()
            assert prefs_b["theme"] == "system"
            assert prefs_b["tutorStyle"] == "socratic"

            # A's update is still intact and isolated.
            prefs_a = (await user_a.get("/api/v1/users/me/preferences")).json()
            assert prefs_a["theme"] == "dark"
            assert prefs_a["tutorStyle"] == "detailed"


@pytest.mark.asyncio
async def test_invalid_preference_value_is_rejected() -> None:
    """Unsupported enum values and out-of-range hours are rejected."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _register(client, "prefs_invalid")

        bad_theme = await client.put(
            "/api/v1/users/me/preferences", json={"theme": "neon"}
        )
        assert bad_theme.status_code == 422

        bad_hours = await client.put(
            "/api/v1/users/me/preferences", json={"defaultStudyHours": 900}
        )
        assert bad_hours.status_code == 422
