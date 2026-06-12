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
