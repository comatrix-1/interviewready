"""ATS scoring endpoint for resume analysis."""

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import logger
from app.models.ats import (
    ATSAnalysisRequest,
    ATSAnalysisResponse,
    BulletAnalysis,
    KeywordMatchResult,
    ScoreBreakdown,
    SectionAnalysis,
)
from app.utils.ats_engine import analyze_resume

router = APIRouter()


@router.post("/analyze")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def analyze(request: Request, body: ATSAnalysisRequest) -> ATSAnalysisResponse:
    """Score a parsed resume for ATS compatibility."""
    try:
        raw = analyze_resume(
            body.resume,
            job_description=body.job_description,
            critic_issues=(
                [ci.model_dump() for ci in body.critic_issues]
                if body.critic_issues
                else None
            ),
        )
    except Exception as exc:
        logger.error("ATS analysis failed", error=str(exc), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ATS analysis failed. Please try again.",
        ) from exc

    sections = []
    for sec in raw["sections"]:
        checks = {}
        suggestions = sec.get("suggestions", [])
        for k, v in sec["checks"].items():
            ba = BulletAnalysis(**v)
            # Attach entry-level suggestions to the first check only
            if suggestions and k == next(iter(sec["checks"])):
                ba.suggestions = suggestions
            checks[k] = ba
        sections.append(SectionAnalysis(section=sec["section"], checks=checks))

    detailed_results = {k: BulletAnalysis(**v) for k, v in raw["detailedResults"].items()}

    # Build optional keyword_match
    keyword_match = None
    if raw.get("keywordResult"):
        kr = raw["keywordResult"]
        keyword_match = KeywordMatchResult(
            match_percentage=kr["matchPercentage"],
            matched_keywords=kr["matchedKeywords"],
            missing_keywords=kr["missingKeywords"],
        )

    # Build optional score breakdown
    score_breakdown = None
    if raw.get("scoreBreakdown"):
        score_breakdown = ScoreBreakdown(**raw["scoreBreakdown"])

    return ATSAnalysisResponse(
        ats_score=raw["atsScore"],
        sections=sections,
        detailed_results=detailed_results,
        keyword_match=keyword_match,
        critic_penalty=raw.get("criticPenalty"),
        critic_issues_applied=raw.get("criticIssuesApplied"),
        score_breakdown=score_breakdown,
        semantic_score=raw.get("semanticScore"),
        validation_warnings=raw.get("validationWarnings", []),
    )
