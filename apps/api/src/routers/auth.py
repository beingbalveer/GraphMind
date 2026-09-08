from datetime import datetime, timezone
from typing import Optional

import structlog
from database import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from models.user import User, WorkspaceMember
from models.workspace import NodeModel, Workspace
from schemas.auth import (
    AuthSuccessResponse,
    GoogleAuthRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    UserResponse,
)
from services.auth_service import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    set_auth_cookies,
    verify_google_token,
    verify_password,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = structlog.get_logger()

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


async def _provision_user_default_workspace(
    session: AsyncSession, user_id: str, full_name: Optional[str] = None
) -> Workspace:
    """
    Seed a personal workspace and initial welcome graph node for newly registered users.
    """
    title = f"{full_name}'s Workspace" if full_name else "Personal Knowledge Space"
    ws = Workspace(
        name=title,
        description="Welcome to your interactive knowledge graph canvas.",
        owner_id=user_id,
    )
    session.add(ws)
    await session.flush()

    member = WorkspaceMember(workspace_id=ws.id, user_id=user_id, role="owner")
    session.add(member)

    # Initial root onboarding card
    root_node = NodeModel(
        workspace_id=ws.id,
        role="assistant",
        content=(
            "# Welcome to GraphMind!\n\n"
            "This is your personal knowledge workspace. You can ask questions, "
            "highlight text to branch deeper, upload documents for grounded RAG, "
            "and navigate ideas on the 2D canvas.\n\n"
            "Try asking your first question below!"
        ),
        position_x=0.0,
        position_y=0.0,
    )
    session.add(root_node)
    await session.flush()
    return ws


@router.post(
    "/google",
    response_model=AuthSuccessResponse,
    summary="Authenticate via Google OAuth ID Token",
)
async def auth_google(
    payload: GoogleAuthRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthSuccessResponse:
    """
    Exchange Google OAuth ID token for session cookies.
    Verifies signature asynchronously via threadpool, creates or updates the user,
    and returns authenticated user profile with HttpOnly cookies.
    """
    try:
        google_info = await verify_google_token(payload.id_token)
    except Exception as e:
        logger.warning("Google authentication token rejected", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}",
        ) from e

    email: str = str(google_info.get("email", "")).strip().lower()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token does not contain a valid email address.",
        )

    full_name: Optional[str] = google_info.get("name")
    avatar_url: Optional[str] = google_info.get("picture")

    # Check if user already exists
    stmt = select(User).where(User.email == email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user:
        # Update profile picture or display name if changed
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
        if full_name and not user.full_name:
            user.full_name = full_name
        user.updated_at = datetime.now(timezone.utc)
    else:
        # Create new Google user
        user = User(
            email=email,
            full_name=full_name,
            avatar_url=avatar_url,
            provider="google",
            token_version=1,
            is_active=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        # Auto-provision initial workspace
        await _provision_user_default_workspace(db, user.id, user.full_name)
        logger.info("New Google user registered with auto-seeded workspace", user_id=user.id, email=user.email)

    # Issue session tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, user.token_version)
    set_auth_cookies(response, access_token, refresh_token)

    return AuthSuccessResponse(
        user=UserResponse.model_validate(user),
        message="Google login successful",
    )


@router.post(
    "/register",
    response_model=AuthSuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new local account with Email and Password",
)
async def auth_register(
    payload: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthSuccessResponse:
    """
    Create a new account with email and password.
    Instant activation without external SMTP dependency.
    """
    email = payload.email.lower().strip()

    # Check email conflict
    stmt = select(User).where(User.email == email)
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    # Hash password via direct bcrypt
    hashed = hash_password(payload.password)

    user = User(
        email=email,
        hashed_password=hashed,
        full_name=payload.full_name,
        provider="local",
        token_version=1,
        is_active=True,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    # Auto-provision initial workspace
    await _provision_user_default_workspace(db, user.id, user.full_name)

    # Issue session tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, user.token_version)
    set_auth_cookies(response, access_token, refresh_token)

    logger.info("New local user registered with auto-seeded workspace", user_id=user.id, email=user.email)

    return AuthSuccessResponse(
        user=UserResponse.model_validate(user),
        message="Account created successfully",
    )


@router.post(
    "/login",
    response_model=AuthSuccessResponse,
    summary="Authenticate with Email and Password",
)
async def auth_login(
    payload: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> AuthSuccessResponse:
    """
    Validate email and password credentials and return session cookies.
    """
    email = payload.email.lower().strip()

    stmt = select(User).where(User.email == email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account was registered via Google Sign-In. Please sign in with Google.",
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # Issue session tokens
    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id, user.token_version)
    set_auth_cookies(response, access_token, refresh_token)

    return AuthSuccessResponse(
        user=UserResponse.model_validate(user),
        message="Logged in successfully",
    )


@router.post(
    "/refresh",
    response_model=MessageResponse,
    summary="Rotate Access Token via Refresh Token Cookie",
)
async def auth_refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Rotate expired access token using the HttpOnly refresh token cookie.
    Validates user.token_version against JWT token_version claim for instant revocation.
    """
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        # Check fallback authorization header
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            refresh_token = auth_header[7:]

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing.",
        )

    try:
        payload = decode_token(refresh_token)
    except Exception as e:
        logger.warning("Invalid or expired refresh token", error=str(e))
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or invalid.",
        ) from e

    if payload.get("type") != "refresh":
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type for refresh.",
        )

    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not user.is_active:
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    # Server-Side Revocation Check: token_version must match database
    token_version = payload.get("token_version")
    if token_version is None or token_version != user.token_version:
        logger.warning(
            "Revoked refresh token attempt detected",
            user_id=user.id,
            claim_version=token_version,
            db_version=user.token_version,
        )
        clear_auth_cookies(response)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has been revoked. Please sign in again.",
        )

    # Issue new access token and maintain refresh token
    new_access_token = create_access_token(user.id)
    set_auth_cookies(response, new_access_token, refresh_token)

    return MessageResponse(
        success=True,
        message="Session refreshed successfully",
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Sign out and invalidate active refresh tokens",
)
async def auth_logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """
    Log out the user, increment user.token_version to revoke all issued refresh tokens,
    and clear session cookies.
    """
    # Attempt to locate user from access or refresh token to invalidate token_version
    token = request.cookies.get("access_token") or request.cookies.get("refresh_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if token:
        try:
            payload = decode_token(token)
            user_id = payload.get("sub")
            if user_id:
                stmt = select(User).where(User.id == user_id)
                user = (await db.execute(stmt)).scalar_one_or_none()
                if user:
                    user.token_version += 1
                    user.updated_at = datetime.now(timezone.utc)
                    await db.flush()
                    logger.info("User session revoked and token_version incremented", user_id=user.id)
        except Exception:
            pass

    clear_auth_cookies(response)
    return MessageResponse(success=True, message="Logged out successfully")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current authenticated user profile",
)
async def auth_me(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """
    Return profile of current authenticated user from HttpOnly cookie or Bearer header.
    """
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    try:
        payload = decode_token(token)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token expired or invalid.",
        ) from e

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type.",
        )

    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or deactivated.",
        )

    return UserResponse.model_validate(user)
