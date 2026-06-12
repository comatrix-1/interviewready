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


class SectionAnalysis(BaseModel):
    """Aggregated checks for one resume section (experience, project, etc.)."""

    section: str
    checks: dict[str, BulletAnalysis]


class ATSAnalysisRequest(BaseModel):
    """Request body for ``POST /api/v1/ats/analyze``."""

    resume: Resume


class ATSAnalysisResponse(BaseModel):
    """Response body for ``POST /api/v1/ats/analyze``."""

    ats_score: int = Field(ge=0, le=100)
    sections: list[SectionAnalysis]
    detailed_results: dict[str, BulletAnalysis]
