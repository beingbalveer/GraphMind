import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.asyncio
async def test_request_id_generated() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/healthz")
        assert response.status_code == 200
        assert "x-request-id" in response.headers
        assert len(response.headers["x-request-id"]) > 0
        assert "x-process-time-ms" in response.headers


@pytest.mark.asyncio
async def test_custom_request_id_preserved() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        custom_id = "custom-test-req-12345"
        response = await client.get("/healthz", headers={"X-Request-ID": custom_id})
        assert response.status_code == 200
        assert response.headers["x-request-id"] == custom_id


@pytest.mark.asyncio
async def test_not_found_structured_error() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/non-existent-route")
        assert response.status_code == 404
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "HTTP_404"
        assert "x-request-id" in response.headers


@pytest.mark.asyncio
async def test_validation_error_structured_payload() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Send empty payload to POST /api/v1/chat/stream which requires prompt or messages
        response = await client.post("/api/v1/chat/stream", json={})
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert data["error"]["details"] is not None
