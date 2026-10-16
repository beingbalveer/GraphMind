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


NODE_EXPORT_FIELDS = {
    "id",
    "parentId",
    "role",
    "content",
    "highlightedContext",
    "provider",
    "model",
    "positionX",
    "positionY",
    "createdAt",
    "updatedAt",
}


@pytest.mark.asyncio
async def test_workspace_export_returns_versioned_owned_data() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _register(client, "export_owner")
        ws_id = (await client.post("/api/v1/workspaces", json={"name": "Export Lab"})).json()["id"]

        root = (
            await client.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={"role": "user", "content": "Question"},
            )
        ).json()["id"]
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"parentId": root, "role": "assistant", "content": "Answer"},
        )
        await client.post(
            f"/api/v1/workspaces/{ws_id}/concepts",
            json={"name": "Event Loops", "masteryLevel": "mastered", "confidenceScore": 0.9},
        )

        resp = await client.get(f"/api/v1/workspaces/{ws_id}/export")
        assert resp.status_code == 200
        data = resp.json()

        assert data["exportVersion"] == "1"
        assert data["exportedAt"]
        assert data["workspace"]["id"] == ws_id
        assert len(data["nodes"]) == 2
        assert len(data["edges"]) == 1
        assert len(data["concepts"]) == 1
        assert data["concepts"][0]["name"] == "Event Loops"
        assert data["counts"] == {
            "nodes": 2,
            "edges": 1,
            "concepts": 1,
            "flashcards": 0,
            "files": 0,
        }


@pytest.mark.asyncio
async def test_workspace_export_excludes_credentials_and_internal_fields() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await _register(client, "export_privacy")
        ws_id = (await client.post("/api/v1/workspaces", json={"name": "Privacy Lab"})).json()["id"]
        await client.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "Private note"},
        )

        resp = await client.get(f"/api/v1/workspaces/{ws_id}/export")
        assert resp.status_code == 200
        body = resp.text

        # No credential material or internal storage fields can appear.
        for forbidden in (
            "api_key",
            "apiKey",
            "sk-",
            "system_prompt",
            "systemPrompt",
            "storage_path",
            "storagePath",
            "embedding",
            "password",
            "hashed_password",
        ):
            assert forbidden not in body, f"export leaked '{forbidden}'"

        # Node entries only carry the allowlisted export fields.
        node = resp.json()["nodes"][0]
        assert set(node.keys()) == NODE_EXPORT_FIELDS
        assert "metadata" not in node


@pytest.mark.asyncio
async def test_workspace_export_requires_membership() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as owner:
        await _register(owner, "export_owner2")
        ws_id = (await owner.post("/api/v1/workspaces", json={"name": "Private Archive"})).json()["id"]
        await owner.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={"role": "user", "content": "Owned"},
        )

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as intruder:
            await _register(intruder, "export_intruder")
            resp = await intruder.get(f"/api/v1/workspaces/{ws_id}/export")
            assert resp.status_code in (403, 404)
