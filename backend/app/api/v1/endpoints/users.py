"""User endpoints: simulated login with self-registration."""

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, Field

from app.api.v1.services import get_user_store
from app.core.config import settings
from app.core.limiter import limiter

router = APIRouter()

MAX_USERNAME_LENGTH = 64


class LoginRequest(BaseModel):
    """Login/registration payload."""

    username: str = Field(min_length=1, max_length=MAX_USERNAME_LENGTH)


@router.post("/login")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def login(request: Request, body: LoginRequest) -> dict:
    """Register the user if they don't exist yet, then return their identity.

    This is a simulation of authentication: no password is involved. The user
    row is created on first login and looked up on subsequent logins.
    """
    username = body.username.strip()
    if not username:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Username must not be empty",
        )

    created = await get_user_store().get_or_create(username)
    return {"username": username, "created": created}
