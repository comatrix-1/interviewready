"""ATS scoring endpoint for resume analysis."""

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import logger
from app.models.ats import ATSAnalysisRequest, ATSAnalysisResponse, BulletAnalysis, SectionAnalysis
from app.utils.ats_engine import analyze_resume

router = APIRouter()


@router.post("/analyze")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def analyze(request: Request, body: ATSAnalysisRequest) -> ATSAnalysisResponse:
    """Score a parsed resume for ATS compatibility."""
    try:
        raw = analyze_resume(body.resume)
    except Exception as exc:
        logger.error(f"ATS analysis failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ATS analysis failed: {exc}",
        ) from exc

    sections = [
        SectionAnalysis(
            section=sec["section"],
            checks={k: BulletAnalysis(**v) for k, v in sec["checks"].items()},
        )
        for sec in raw["sections"]
    ]
    detailed_results = {k: BulletAnalysis(**v) for k, v in raw["detailedResults"].items()}

    return ATSAnalysisResponse(
        ats_score=raw["atsScore"],
        sections=sections,
        detailed_results=detailed_results,
    )
