import asyncio
import uuid
from unittest.mock import AsyncMock

import pytest
from database import get_session_factory
from httpx import ASGITransport, AsyncClient
from main import app
from models.user import WorkspaceMember

LAYOUT = {
    "version": "spine-v1", "positions": {"segment:a": {"x": 12, "y": 24}},
    "viewport": {"x": 0, "y": 10, "zoom": 0.8}, "topologyKey": "a",
}


@pytest.fixture(autouse=True)
def no_provider_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("services.semantic_service.SemanticService.compute_and_save_node_embedding", AsyncMock())


async def register(client: AsyncClient) -> str:
    response = await client.post("/api/v1/auth/register", json={
        "email": f"canvas_{uuid.uuid4().hex}@example.com", "password": "CanvasTest123!",
    })
    assert response.status_code == 201
    return response.json()["user"]["id"]


async def create_chat(client: AsyncClient) -> tuple[str, str]:
    ws = await client.post("/api/v1/workspaces", json={"name": "Canvas test"})
    assert ws.status_code == 201
    wid = ws.json()["id"]
    node = await client.post(f"/api/v1/workspaces/{wid}/nodes", json={
        "id": f"node_{uuid.uuid4().hex[:12]}", "role": "user", "content": "Hello",
    })
    assert node.status_code == 201
    return wid, node.json()["id"]


def endpoint(wid: str, cid: str) -> str:
    return f"/api/v1/workspaces/{wid}/chats/{cid}/canvas-layout"


@pytest.mark.asyncio
async def test_canvas_create_revision_conflict_and_kind_isolation() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await register(client)
        wid, cid = await create_chat(client)
        url = endpoint(wid, cid)
        missing = await client.get(url)
        assert missing.status_code == 200
        assert missing.json() == {"layout": None, "revision": 0}
        saved = await client.put(url, json={"baseRevision": 0, "layout": LAYOUT})
        assert saved.status_code == 200
        assert saved.json() == {"layout": LAYOUT, "revision": 1}
        stale = await client.put(url, json={"baseRevision": 0, "layout": {**LAYOUT, "positions": {}}})
        assert stale.status_code == 409
        assert (await client.get(url)).json() == saved.json()
        assert (await client.get(url + "?kind=curriculum")).json()["revision"] == 0
        updated = await client.put(url, json={"baseRevision": 1, "layout": LAYOUT})
        assert updated.json()["revision"] == 2


@pytest.mark.asyncio
async def test_canvas_scopes_chat_root_and_membership() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as owner:
        await register(owner)
        wid, cid = await create_chat(owner)
        other_wid, other_cid = await create_chat(owner)
        assert (await owner.get(endpoint(wid, other_cid))).status_code == 404
        child = await owner.post(f"/api/v1/workspaces/{wid}/nodes", json={
            "id": f"node_{uuid.uuid4().hex[:12]}", "parentId": cid,
            "role": "assistant", "content": "Reply",
        })
        assert (await owner.get(endpoint(wid, child.json()["id"]))).status_code == 404
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as viewer:
            uid = await register(viewer)
            assert (await viewer.get(endpoint(wid, cid))).status_code == 404
            async with get_session_factory()() as db:
                db.add(WorkspaceMember(workspace_id=wid, user_id=uid, role="viewer"))
                await db.commit()
            assert (await viewer.get(endpoint(wid, cid))).status_code == 200
            assert (await viewer.put(endpoint(wid, cid), json={"baseRevision": 0, "layout": LAYOUT})).status_code == 403
        assert other_wid != wid


@pytest.mark.asyncio
async def test_canvas_validation_and_concurrent_first_write() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await register(client)
        wid, cid = await create_chat(client)
        url = endpoint(wid, cid)
        for invalid in [
            {**LAYOUT, "viewport": {"x": 0, "y": 0, "zoom": 0}},
            {**LAYOUT, "positions": {str(i): {"x": 0, "y": 0} for i in range(2001)}},
        ]:
            assert (await client.put(url, json={"baseRevision": 0, "layout": invalid})).status_code == 422
        assert (await client.get(url)).json()["revision"] == 0
        results = await asyncio.gather(*[
            client.put(url, json={"baseRevision": 0, "layout": LAYOUT}) for _ in range(2)
        ])
        assert sorted(r.status_code for r in results) == [200, 409]
        assert (await client.get(url)).json()["revision"] == 1
