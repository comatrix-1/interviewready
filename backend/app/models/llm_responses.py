"""Pydantic schemas for LLM agent structured outputs.

This module contains small, explicit Pydantic models that describe
the expected structured output shapes returned by LLM-backed agents.

Start small: this PR adds OrchestrationResult used by the orchestration
agent. Follow-on PRs will add other agent schemas and helpers.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class OrchestrationDetail(BaseModel):
    """A single step/detail item in an orchestration result.

    Example:
        OrchestrationDetail(step="check-format", ok=True, note="ran ruff", metadata={"files": 3})
    """

    step: str = Field(..., min_length=1)
    ok: bool = True
    note: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "extra": "forbid"
    }


class OrchestrationResult(BaseModel):
    """Structured result for orchestration decisions produced by agents.

    Fields:
    - decision: short decision token such as "approve", "reject", "defer"
    - confidence: float in range [0.0, 1.0]
    - details: list of small step/detail objects providing reasoning or checks
    """

    decision: str = Field(..., min_length=1)
    confidence: float = Field(..., ge=0.0, le=1.0)
    details: list[OrchestrationDetail] = Field(default_factory=list)

    model_config = {
        "extra": "forbid"
    }


# Pydantic v2: when using postponed annotations (from __future__ import annotations),
# call model_rebuild() after all related models are defined so forward
# references and annotated types are resolved. This avoids PydanticUserError
# about classes not being fully defined.
OrchestrationDetail.model_rebuild()
OrchestrationResult.model_rebuild()

__all__ = ["OrchestrationResult", "OrchestrationDetail"]
