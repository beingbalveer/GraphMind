import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


def unique_email(prefix: str = "rbac") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.mark.asyncio
async def test_workspace_ownership_and_scoping() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client_a:
        # 1. Register User A
        email_a = unique_email("user_a")
        await client_a.post(
            "/api/v1/auth/register",
            json={
                "email": email_a,
                "password": "PasswordUserA123!",
                "fullName": "User Alpha",
            },
        )

        # 2. User A creates a workspace
        create_resp = await client_a.post(
            "/api/v1/workspaces",
            json={
                "name": "Alpha Private Lab",
                "description": "Top secret workspace",
            },
        )
        assert create_resp.status_code == 201
        ws_a_id = create_resp.json()["id"]

        # 3. User A lists workspaces - must contain ws_a_id
        list_a = await client_a.get("/api/v1/workspaces")
        assert list_a.status_code == 200
        ids_a = [w["id"] for w in list_a.json()["workspaces"]]
        assert ws_a_id in ids_a


@pytest.mark.asyncio
async def test_cross_tenant_isolation() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client_a:
        # 1. User A registers and creates a private workspace
        email_a = unique_email("owner_a")
        await client_a.post(
            "/api/v1/auth/register",
            json={
                "email": email_a,
                "password": "PasswordUserA123!",
            },
        )
        create_resp = await client_a.post(
            "/api/v1/workspaces",
            json={"name": "Confidential Research"},
        )
        assert create_resp.status_code == 201
        ws_id = create_resp.json()["id"]

        # 2. User B registers
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client_b:
            email_b = unique_email("intruder_b")
            await client_b.post(
                "/api/v1/auth/register",
                json={
                    "email": email_b,
                    "password": "PasswordUserB123!",
                },
            )

            # User B lists workspaces - should NOT see User A's workspace
            list_b = await client_b.get("/api/v1/workspaces")
            assert list_b.status_code == 200
            ids_b = [w["id"] for w in list_b.json()["workspaces"]]
            assert ws_id not in ids_b

            # User B attempts to read User A's workspace graph
            read_resp = await client_b.get(f"/api/v1/workspaces/{ws_id}/graph")
            assert read_resp.status_code in [403, 404]

            # User B attempts to read User A's chats
            chats_resp = await client_b.get(f"/api/v1/workspaces/{ws_id}/chats")
            assert chats_resp.status_code in [403, 404]

            # User B attempts to create a node in User A's workspace
            create_node = await client_b.post(
                f"/api/v1/workspaces/{ws_id}/nodes",
                json={
                    "role": "user",
                    "content": "Malicious intrusion node",
                },
            )
            assert create_node.status_code in [403, 404]

            # User B attempts to delete User A's workspace
            delete_resp = await client_b.delete(f"/api/v1/workspaces/{ws_id}")
            assert delete_resp.status_code in [403, 404]


@pytest.mark.asyncio
async def test_owner_write_operations() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client_a:
        # Register User A
        email_a = unique_email("writer_a")
        await client_a.post(
            "/api/v1/auth/register",
            json={
                "email": email_a,
                "password": "PasswordUserA123!",
            },
        )
        create_resp = await client_a.post(
            "/api/v1/workspaces",
            json={"name": "Owner Project"},
        )
        ws_id = create_resp.json()["id"]

        # Owner creates a node
        node_resp = await client_a.post(
            f"/api/v1/workspaces/{ws_id}/nodes",
            json={
                "id": f"node_{uuid.uuid4().hex[:8]}",
                "role": "user",
                "content": "Authorized node creation",
            },
        )
        assert node_resp.status_code == 201

        # Owner reads graph
        graph_resp = await client_a.get(f"/api/v1/workspaces/{ws_id}/graph")
        assert graph_resp.status_code == 200
        assert len(graph_resp.json()["nodes"]) >= 1

        # Owner deletes workspace
        del_resp = await client_a.delete(f"/api/v1/workspaces/{ws_id}")
        assert del_resp.status_code == 204
