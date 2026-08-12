"""Session endpoints for retrieving persisted session state."""

import json
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Request, status
from pydantic import BaseModel

from app.api.v1.services import (
    get_or_create_session_context,
    get_session_context,
    get_session_store,
    resolve_user_id,
)
from app.core.config import settings
from app.core.limiter import limiter
from app.models.resume import Resume

router = APIRouter()


class SeedSessionContextRequest(BaseModel):
    """Resume + job description to persist on a session before a voice interview."""

    resumeData: Resume | None = None
    jobDescription: str = ""


@router.post("/new")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def create_session(request: Request) -> dict:
    """Create a new session and return the session ID."""
    user_id = resolve_user_id(request)
    session_store = get_session_store()
    session_id, _ = await session_store.create_session(user_id)
    return {"session_id": session_id}


@router.get("/{session_id}/resume")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def get_session_resume(
    request: Request,
    session_id: Annotated[str, Path()],
) -> Resume:
    """Return parsed resume JSON currently persisted for a session."""
    user_id = resolve_user_id(request)

    try:
        context = await get_session_context(session_id=session_id, user_id=user_id)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    if context is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )

    shared_memory = context.shared_memory or {}
    raw_resume = shared_memory.get("current_resume")
    if not isinstance(raw_resume, dict) or not raw_resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No parsed resume found for this session",
        )

    try:
        return Resume.model_validate(raw_resume)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Stored resume data is invalid: {exc}",
        ) from exc


@router.post("/{session_id}/context")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def seed_session_context(
    request: Request,
    session_id: Annotated[str, Path()],
    body: SeedSessionContextRequest,
) -> dict:
    """Persist resume + job description on a session (used by the voice interview)."""
    user_id = resolve_user_id(request)
    try:
        context = await get_or_create_session_context(session_id=session_id, user_id=user_id)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    if body.resumeData is not None:
        context.resume_data = json.dumps(body.resumeData.model_dump(exclude_none=True))
        context.shared_memory = {
            **(context.shared_memory or {}),
            "current_resume": body.resumeData.model_dump(exclude_none=True),
        }
    if body.jobDescription:
        context.job_description = body.jobDescription

    await get_session_store().save(context)
    return {"ok": True}
