"""LSI-033 — Files and attachments parity coverage.

Verifies the existing workspace file library and chat attachment ingestion keep
working through the real services, and that private uploads stay strictly
workspace-scoped: role-based authorization is enforced and a private upload can
never be read, listed, downloaded, or deleted through another workspace or by a
non-member.
"""

import io
import uuid
from unittest.mock import patch

import pytest
from database import get_session_factory
from httpx import ASGITransport, AsyncClient
from main import app
from models.user import WorkspaceMember

PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"


async def _register(client: AsyncClient, prefix: str) -> str:
    email = f"files_{prefix}_{uuid.uuid4().hex}@example.com"
    resp = await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123456!"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["user"]["id"]


async def _create_workspace(client: AsyncClient, name: str) -> str:
    resp = await client.post("/api/v1/workspaces", json={"name": name})
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


async def _upload(
    client: AsyncClient,
    workspace_id: str,
    name: str = "diagram.png",
    content: bytes = PNG_BYTES,
    mime: str = "image/png",
):
    return await client.post(
        f"/api/v1/workspaces/{workspace_id}/files/upload",
        files={"file": (name, io.BytesIO(content), mime)},
    )


def _error_message(response) -> str:
    """Read the shared error envelope ``{"error": {"message": ...}}``."""
    body = response.json()
    return str(body.get("error", {}).get("message", body.get("detail", ""))).lower()


@pytest.mark.asyncio
async def test_file_library_authorization_roles_and_private_isolation() -> None:
    """Viewers can read but not mutate; non-members get 404 on every endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as owner:
        await _register(owner, "owner")
        ws_id = await _create_workspace(owner, "Owner Files Workspace")

        upload = await _upload(owner, ws_id)
        assert upload.status_code == 201, upload.text
        file_id = upload.json()["id"]
        # The advertised download URL is the workspace-scoped private path.
        assert upload.json()["url"] == f"/api/v1/workspaces/{ws_id}/files/{file_id}/download"

        # Viewer member: read allowed, writes forbidden (403).
        async with AsyncClient(transport=transport, base_url="http://test") as viewer:
            viewer_id = await _register(viewer, "viewer")
            async with get_session_factory()() as db:
                db.add(WorkspaceMember(workspace_id=ws_id, user_id=viewer_id, role="viewer"))
                await db.commit()

            assert (await viewer.get(f"/api/v1/workspaces/{ws_id}/files")).status_code == 200
            assert (
                await viewer.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            ).status_code == 200
            assert (
                await viewer.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}/download")
            ).status_code == 200
            assert (await _upload(viewer, ws_id, name="viewer.png")).status_code == 403
            assert (
                await viewer.delete(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            ).status_code == 403

        # Unrelated authenticated user: 404 everywhere (no existence disclosure).
        async with AsyncClient(transport=transport, base_url="http://test") as intruder:
            await _register(intruder, "intruder")
            assert (await intruder.get(f"/api/v1/workspaces/{ws_id}/files")).status_code == 404
            assert (
                await intruder.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            ).status_code == 404
            assert (
                await intruder.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}/download")
            ).status_code == 404
            assert (await _upload(intruder, ws_id)).status_code == 404
            assert (
                await intruder.delete(f"/api/v1/workspaces/{ws_id}/files/{file_id}")
            ).status_code == 404

        # Forbidden attempts above must not have destroyed or mutated the file.
        assert (await owner.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}")).status_code == 200
        assert (
            await owner.get(f"/api/v1/workspaces/{ws_id}/files/{file_id}/download")
        ).status_code == 200


@pytest.mark.asyncio
async def test_private_upload_never_appears_in_another_workspace() -> None:
    """A private upload is invisible through any other workspace, even same owner."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as owner:
        await _register(owner, "owner")
        ws_a = await _create_workspace(owner, "Private Workspace A")
        ws_b = await _create_workspace(owner, "Private Workspace B")

        upload = await _upload(
            owner, ws_a, name="secret-notes.md", content=b"# Private\nsecret", mime="text/markdown"
        )
        assert upload.status_code == 201, upload.text
        body = upload.json()
        file_id = body["id"]

        # The API never serializes server-side storage locations.
        assert "storagePath" not in body
        assert "storage_path" not in body

        # Workspace B's library must not list A's private upload.
        listing_b = (await owner.get(f"/api/v1/workspaces/{ws_b}/files")).json()
        assert all(f["id"] != file_id for f in listing_b)

        # Direct access through B is denied for the same owner.
        assert (await owner.get(f"/api/v1/workspaces/{ws_b}/files/{file_id}")).status_code == 404
        assert (
            await owner.get(f"/api/v1/workspaces/{ws_b}/files/{file_id}/download")
        ).status_code == 404
        assert (await owner.delete(f"/api/v1/workspaces/{ws_b}/files/{file_id}")).status_code == 404

        # The file is still intact and accessible inside its own workspace.
        assert (await owner.get(f"/api/v1/workspaces/{ws_a}/files/{file_id}")).status_code == 200


@pytest.mark.asyncio
async def test_upload_errors_are_client_safe_and_processing_metadata_exposed() -> None:
    """Oversized and missing-workspace uploads fail safely; extraction surfaces metadata."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as owner:
        await _register(owner, "owner")
        ws_id = await _create_workspace(owner, "Errors Workspace")

        # 1. Oversized payload -> 400 with a bounded, client-safe message.
        with patch("services.file_service.MAX_FILE_SIZE_BYTES", 8):
            too_big = await _upload(
                owner, ws_id, name="big.png", content=b"0123456789", mime="image/png"
            )
        assert too_big.status_code == 400
        assert "exceeds maximum limit" in _error_message(too_big)

        # 2. Missing workspace -> 404 (authorization gate, never leaks a path).
        missing = await _upload(owner, "ws_missing_404", name="x.png")
        assert missing.status_code == 404
        assert "not found" in _error_message(missing)

        # 3. Successful upload of a tabular file exposes processing metadata.
        csv = await _upload(owner, ws_id, name="rows.csv", content=b"a,b\n1,2", mime="text/csv")
        assert csv.status_code == 201, csv.text
        csv_body = csv.json()
        assert csv_body["fileCategory"] == "tabular"
        assert csv_body["metadata"]["row_count"] == 1
        assert "| a | b |" in csv_body["extractedText"]


@pytest.mark.asyncio
async def test_chat_attachment_ingestion_uses_real_workspace_file() -> None:
    """A workspace file id can be attached to a real chat completion request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as owner:
        await _register(owner, "owner")
        ws_id = await _create_workspace(owner, "Attachment Workspace")

        upload = await _upload(
            owner,
            ws_id,
            name="utils.py",
            content=b"def add(a, b):\n    return a + b\n",
            mime="text/x-python",
        )
        assert upload.status_code == 201, upload.text
        uploaded = upload.json()

        resp = await owner.post(
            "/api/v1/chat/completions",
            json={
                "prompt": "Review this implementation",
                "provider": "mock",
                "model": "mock-model",
                "attachments": [
                    {
                        "id": uploaded["id"],
                        "name": uploaded["name"],
                        "mime_type": uploaded["mimeType"],
                        "fileCategory": uploaded["fileCategory"],
                        "extracted_text": uploaded["extractedText"],
                    }
                ],
            },
        )
        assert resp.status_code == 200, resp.text
        assert "content" in resp.json()
