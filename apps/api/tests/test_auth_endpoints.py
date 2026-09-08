import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


def unique_email(prefix: str = "test") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}@example.com"


@pytest.mark.asyncio
async def test_register_success() -> None:
    email = unique_email("register")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "strongPassword123!",
                "fullName": "Tester Registration",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "user" in data
        assert data["user"]["email"] == email
        assert data["user"]["fullName"] == "Tester Registration"
        assert data["user"]["provider"] in ["local", "email"]

        # Check cookies
        assert "access_token" in client.cookies
        assert "refresh_token" in client.cookies


@pytest.mark.asyncio
async def test_register_duplicate_email() -> None:
    email = unique_email("duplicate")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First registration
        resp1 = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "strongPassword123!",
            },
        )
        assert resp1.status_code == 201

        # Second registration with duplicate email
        resp2 = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "anotherPassword123!",
            },
        )
        assert resp2.status_code == 409
        err_json = resp2.json()
        error_text = err_json.get("detail") or err_json.get("error", {}).get("message", "")
        assert "already exists" in error_text.lower() or "already registered" in error_text.lower()


@pytest.mark.asyncio
async def test_register_short_password() -> None:
    email = unique_email("short")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "short",
            },
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_login_flow() -> None:
    email = unique_email("login")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register user
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "myValidPassword123!",
                "fullName": "Login User",
            },
        )
        assert reg_resp.status_code == 201

        # Clear client cookies to simulate fresh unauthenticated session
        client.cookies.clear()

        # Login with invalid password
        bad_login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": "wrongPassword!",
            },
        )
        assert bad_login.status_code == 401

        # Login with correct password
        good_login = await client.post(
            "/api/v1/auth/login",
            json={
                "email": email,
                "password": "myValidPassword123!",
            },
        )
        assert good_login.status_code == 200
        data = good_login.json()
        assert data["user"]["email"] == email
        assert "access_token" in client.cookies
        assert "refresh_token" in client.cookies


@pytest.mark.asyncio
async def test_me_and_refresh_flow() -> None:
    email = unique_email("me")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register and auto-authenticate
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "passwordMe123!",
                "fullName": "Me Profile Tester",
            },
        )
        assert reg_resp.status_code == 201

        # GET /auth/me
        me_resp = await client.get("/api/v1/auth/me")
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        user_info = me_data.get("user", me_data)
        assert user_info["email"] == email
        assert user_info["fullName"] == "Me Profile Tester"

        # POST /auth/refresh
        refresh_resp = await client.post("/api/v1/auth/refresh")
        assert refresh_resp.status_code == 200
        assert "access_token" in client.cookies


@pytest.mark.asyncio
async def test_logout_and_revocation() -> None:
    email = unique_email("logout")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        reg_resp = await client.post(
            "/api/v1/auth/register",
            json={
                "email": email,
                "password": "logoutPassword123!",
            },
        )
        assert reg_resp.status_code == 201
        old_refresh_cookie = client.cookies.get("refresh_token")
        assert old_refresh_cookie is not None

        # Call logout
        logout_resp = await client.post("/api/v1/auth/logout")
        assert logout_resp.status_code == 200

        # Attempt to refresh with old refresh token on a new client
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client2:
            client2.cookies.set("refresh_token", old_refresh_cookie)
            bad_refresh = await client2.post("/api/v1/auth/refresh")
            assert bad_refresh.status_code == 401
