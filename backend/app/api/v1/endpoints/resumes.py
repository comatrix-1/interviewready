"""Saved-resume endpoints: list and create user-scoped resume snapshots."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.v1.services import get_resume_store, resolve_user_id
from app.core.config import settings
from app.core.limiter import limiter
from app.db.resume_store import ResumePersistenceUnavailableError
from app.models import Resume

router = APIRouter()

UNAVAILABLE_DETAIL = "Saved resumes require DATABASE_URL to be configured."


class CreateSavedResumeRequest(BaseModel):
    """Payload for saving a resume snapshot."""

    filename: str
    resume: Resume

    @field_validator("filename")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("filename must not be blank")
        return v


class SavedResumeResponse(BaseModel):
    """Serialized saved-resume record (camelCase ``createdAt``)."""

    id: str
    filename: str
    created_at: datetime = Field(alias="createdAt")
    resume: Resume

    model_config = ConfigDict(populate_by_name=True)


@router.get("")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def list_saved_resumes(request: Request) -> dict:
    """Return the caller's saved resumes, newest first."""
    try:
        records = await get_resume_store().list_for_user(user_id=resolve_user_id(request))
    except ResumePersistenceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=UNAVAILABLE_DETAIL,
        ) from exc
    return {
        "resumes": [
            {
                "id": r.id,
                "filename": r.filename,
                "createdAt": r.created_at,
                "resume": r.resume.model_dump(mode="json"),
            }
            for r in records
        ]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def create_saved_resume(request: Request, body: CreateSavedResumeRequest) -> SavedResumeResponse:
    """Persist a resume snapshot for the caller."""
    try:
        record = await get_resume_store().create(
            user_id=resolve_user_id(request),
            filename=body.filename,
            resume=body.resume,
        )
    except ResumePersistenceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=UNAVAILABLE_DETAIL,
        ) from exc
    return SavedResumeResponse(
        id=record.id,
        filename=record.filename,
        createdAt=record.created_at,
        resume=record.resume,
    )
