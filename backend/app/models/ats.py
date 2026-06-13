"""Pydantic v2 models for the ATS scoring endpoint."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from .resume import Resume

PassStatus = Literal["ok", "no", "min"]


class BulletAnalysis(BaseModel):
    """Result of a single ATS check against a set of bullets."""

    model_config = ConfigDict(populate_by_name=True)

    pass_: PassStatus = Field(alias="pass")
    bullet_to_highlight: list[int] | None = None
    message: str | None = None
    suggestions: list[str] | None = None


class SectionAnalysis(BaseModel):
    """Aggregated checks for one resume section (experience, project, etc.)."""

    section: str
    checks: dict[str, BulletAnalysis]


class CriticIssue(BaseModel):
    """An issue surfaced by the ResumeCriticAgent."""

    location: str
    type: Literal["ats", "structure", "impact", "readability"]
    severity: Literal["HIGH", "MEDIUM", "LOW"]
    description: str


class KeywordMatchResult(BaseModel):
    """Result of JD keyword matching against the resume."""

    match_percentage: float = Field(ge=0, le=100)
    matched_keywords: list[str] = Field(default_factory=list)
    missing_keywords: list[str] = Field(default_factory=list)


class ScoreBreakdown(BaseModel):
    """Human-readable breakdown of how the ATS score was calculated."""

    section_presence: float = Field(ge=0, description="Points from having expected sections")
    bullet_quality: float = Field(ge=0, description="Points from bullet point quality")
    jd_keyword_match: float = Field(ge=0, description="Points from JD keyword overlap")
    semantic_match: float = Field(ge=0, description="Points from semantic similarity")
    bonuses: float = Field(ge=0, description="Contact presence and structural bonuses")
    penalties: float = Field(le=0, description="Deductions for issues found")
    raw_score: float = Field(ge=0, description="Total raw score before normalization")
    max_possible: float = Field(gt=0, description="Maximum possible raw score")


class ATSAnalysisRequest(BaseModel):
    """Request body for ``POST /api/v1/ats/analyze``."""

    resume: Resume
    job_description: str | None = None
    critic_issues: list[CriticIssue] | None = None


class ATSAnalysisResponse(BaseModel):
    """Response body for ``POST /api/v1/ats/analyze``."""

    ats_score: int = Field(ge=0, le=100)
    sections: list[SectionAnalysis]
    detailed_results: dict[str, BulletAnalysis]
    keyword_match: KeywordMatchResult | None = None
    critic_penalty: int | None = None
    critic_issues_applied: list[CriticIssue] | None = None
    score_breakdown: ScoreBreakdown | None = None
    semantic_score: float | None = Field(default=None, ge=0, le=1, description="Cosine similarity score (0-1) when JD provided")
