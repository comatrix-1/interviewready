"""Contract tests for shared AgentInput/AgentResponse models."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.models.agent import AgentResponse


def test_agent_response_accepts_structured_json_content() -> None:
    response = AgentResponse(
        agent_name="AnyAgent",
        content={"ok": True, "items": [1, 2, 3]},
        reasoning="test",
        confidence_score=0.5,
        needs_review=False,
        low_confidence_fields=[],
        decision_trace=[],
        sharp_metadata={},
    )
    assert isinstance(response.content, dict)


def test_agent_response_rejects_string_content() -> None:
    with pytest.raises(ValidationError):
        AgentResponse(
            agent_name="AnyAgent",
            content="{}",
            reasoning="test",
            confidence_score=0.5,
            needs_review=False,
            low_confidence_fields=[],
            decision_trace=[],
            sharp_metadata={},
        )

