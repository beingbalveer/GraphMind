from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt
import structlog
from config import get_settings
from fastapi import Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from starlette.concurrency import run_in_threadpool

logger = structlog.get_logger()
settings = get_settings()


def hash_password(password: str) -> str:
    """
    Hash a plaintext password using direct bcrypt.
    """
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plaintext password against a stored bcrypt hash in constant time.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception as e:
        logger.warning("Password verification failure", error=str(e))
        return False


def _verify_google_token_sync(token: str, client_id: Optional[str]) -> Dict[str, Any]:
    """
    Synchronous Google ID token verification against Google certs.
    """
    request = google_requests.Request()
    # If client_id is configured, verify audience; otherwise decode payload with cert check
    verified: Dict[str, Any] = id_token.verify_oauth2_token(  # type: ignore[no-untyped-call]
        token, request, audience=client_id
    )
    return verified


async def verify_google_token(token: str, client_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Verify a Google OAuth ID token asynchronously via a threadpool to prevent
    blocking the asyncio event loop during network requests to Google public certs.
    """
    target_client_id = client_id or settings.GOOGLE_CLIENT_ID
    try:
        payload: Dict[str, Any] = await run_in_threadpool(
            _verify_google_token_sync, token, target_client_id
        )
        return payload
    except Exception as e:
        logger.warning("Google token verification rejected", error=str(e))
        raise ValueError(f"Invalid Google ID token: {str(e)}") from e


def create_access_token(user_id: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Generate a signed JWT access token for user authentication.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload: Dict[str, Any] = {
        "sub": user_id,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(
    user_id: str,
    token_version: int,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Generate a signed JWT refresh token embedded with user.token_version for server-side revocation.
    """
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS))
    payload: Dict[str, Any] = {
        "sub": user_id,
        "type": "refresh",
        "token_version": token_version,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a signed JWT token.
    Raises jwt.PyJWTError (e.g. ExpiredSignatureError, InvalidTokenError) on failure.
    """
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["exp", "sub", "type"]},
    )


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """
    Attach secure HttpOnly session cookies to the HTTP response.
    """
    is_production = settings.ENVIRONMENT == "production"

    # Access Token Cookie (1 hour)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    # Refresh Token Cookie (30 days)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """
    Delete session cookies by setting max_age=0.
    """
    is_production = settings.ENVIRONMENT == "production"
    response.delete_cookie(key="access_token", path="/", secure=is_production, samesite="lax")
    response.delete_cookie(key="refresh_token", path="/", secure=is_production, samesite="lax")
