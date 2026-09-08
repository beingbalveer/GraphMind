import re
from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from pydantic.alias_generators import to_camel

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def validate_email_format(v: str) -> str:
    cleaned = str(v).strip().lower()
    if not EMAIL_REGEX.match(cleaned):
        raise ValueError("Invalid email address format")
    return cleaned


Email = Annotated[str, BeforeValidator(validate_email_format)]


class BaseAuthSchema(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )


class GoogleAuthRequest(BaseAuthSchema):
    """
    Payload for Google Identity Services token exchange.
    """

    id_token: str = Field(min_length=10, description="Google OAuth 2.0 ID token credential")


class RegisterRequest(BaseAuthSchema):
    """
    Payload for email/password registration.
    """

    email: Email = Field(description="User email address")
    password: str = Field(min_length=8, max_length=128, description="Password (at least 8 characters)")
    full_name: Optional[str] = Field(default=None, max_length=255, description="User full display name")


class LoginRequest(BaseAuthSchema):
    """
    Payload for email/password authentication.
    """

    email: Email = Field(description="User email address")
    password: str = Field(min_length=1, max_length=128, description="User password")


class UserResponse(BaseAuthSchema):
    """
    Public user profile schema returned to client.
    """

    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    provider: str = "google"
    is_active: bool = True
    created_at: datetime


class AuthSuccessResponse(BaseAuthSchema):
    """
    Envelope response for successful login / register.
    """

    user: UserResponse
    message: str = "Authentication successful"


class MessageResponse(BaseAuthSchema):
    """
    Generic operation status response.
    """

    success: bool = True
    message: str = "Operation completed successfully"


class TokenPayload(BaseModel):
    """
    Decoded JWT token payload claims.
    """

    sub: str
    type: str  # "access" or "refresh"
    token_version: Optional[int] = None
    exp: int
