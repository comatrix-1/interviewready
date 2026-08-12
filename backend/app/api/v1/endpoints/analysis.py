"""Session-free analysis endpoints (parse, critique, alignment).

These endpoints run the orchestrator with an ephemeral SessionContext that is
never persisted. The frontend uses sessions only for the interview coach step.
"""

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.v1.services import get_orchestration_agent, resolve_user_id
from app.core.config import settings
from app.core.limiter import limiter
from app.models import ChatRequest, Resume, SessionContext
from app.models.agent import ResumeFile

router = APIRouter()

PARSE_FAILED_DETAIL = "Failed to parse the resume file."
NO_RESUME_DETAIL = "No resume content provided."


class ParseResumeRequest(BaseModel):
    file: ResumeFile


class ParseResumeResponse(BaseModel):
    resume: Resume | None = None
    needs_review: bool = Field(alias="needsReview")
    confidence_score: float = Field(alias="confidenceScore")
    low_confidence_fields: list[str] = Field(alias="lowConfidenceFields")
    validation_errors: list[str] = Field(alias="validationErrors")

    model_config = ConfigDict(populate_by_name=True)


class CritiqueRequest(BaseModel):
    resume: Resume


class AlignmentRequest(BaseModel):
    resume: Resume
    jobDescription: str

    @field_validator("jobDescription")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("jobDescription must not be blank")
        return v


def _extract_parse_result(
    response,
) -> tuple[Resume | None, bool, float, list[str], list[str]]:
    """Pull the parsed resume (and quality flags) out of either response shape.

    Normalize-without-review produces ``content == {"resume": {...}}``; a HITL
    review produces ``content == {"review_payload": {"extracted_data": {...}}}``.
    """
    content = response.content if isinstance(response.content, dict) else {}
    review_payload = content.get("review_payload")
    if isinstance(review_payload, dict):
        extracted = review_payload.get("extracted_data")
        if isinstance(extracted, dict):
            return (
                Resume.model_validate(extracted),
                True,
                float(review_payload.get("confidence_score") or 0.0),
                list(review_payload.get("fields_requiring_attention") or []),
                list(review_payload.get("validation_errors") or []),
            )
        return None, True, 0.0, [], []
    resume_dict = content.get("resume")
    if isinstance(resume_dict, dict):
        sharp = response.sharp_metadata or {}
        return (
            Resume.model_validate(resume_dict),
            bool(response.needs_review),
            float(response.confidence_score or 0.0),
            list(response.low_confidence_fields or []),
            list(sharp.get("validation_errors") or []),
        )
    return None, False, 0.0, [], []


@router.post("/parse")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def parse_resume(request: Request, body: ParseResumeRequest) -> ParseResumeResponse:
    """Parse an uploaded PDF into a structured resume. No session required."""
    user_id = resolve_user_id(request)
    context = SessionContext(session_id=None, user_id=user_id)
    orchestrator = get_orchestration_agent()
    internal = await run_in_threadpool(
        orchestrator.orchestrate,
        ChatRequest(
            intent="RESUME_PARSE",
            resumeFile=body.file,
            jobDescription="",
            messageHistory=[],
        ),
        context,
    )
    resume, needs_review, confidence, low_confidence, validation_errors = _extract_parse_result(internal)
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=PARSE_FAILED_DETAIL,
        )
    return ParseResumeResponse(
        resume=resume,
        needs_review=needs_review,
        confidence_score=confidence,
        low_confidence_fields=low_confidence,
        validation_errors=validation_errors,
    )


@router.post("/critique")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def critique_resume(request: Request, body: CritiqueRequest) -> dict:
    """Critique a resume for ATS compatibility. No session required."""
    user_id = resolve_user_id(request)
    context = SessionContext(session_id=None, user_id=user_id)
    orchestrator = get_orchestration_agent()
    internal = await run_in_threadpool(
        orchestrator.orchestrate,
        ChatRequest(
            intent="RESUME_CRITIC",
            resumeData=body.resume,
            jobDescription="",
            messageHistory=[],
        ),
        context,
    )
    if internal.agent_name == "NormalizeStage":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=NO_RESUME_DETAIL,
        )
    if not isinstance(internal.content, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Critique analysis produced no result.",
        )
    return internal.content


@router.post("/alignment")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def run_alignment(request: Request, body: AlignmentRequest) -> dict:
    """Evaluate resume fit against a job description. No session required."""
    user_id = resolve_user_id(request)
    context = SessionContext(session_id=None, user_id=user_id)
    orchestrator = get_orchestration_agent()
    internal = await run_in_threadpool(
        orchestrator.orchestrate,
        ChatRequest(
            intent="ALIGNMENT",
            resumeData=body.resume,
            jobDescription=body.jobDescription,
            messageHistory=[],
        ),
        context,
    )
    if internal.agent_name == "NormalizeStage":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=NO_RESUME_DETAIL,
        )
    if not isinstance(internal.content, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Alignment analysis produced no result.",
        )
    return internal.content
