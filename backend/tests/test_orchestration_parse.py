"""Unit tests for the parse-only orchestration path (RESUME_PARSE intent)."""

import json

from app.models import ChatRequest, SessionContext
from app.models.agent import Intent
from app.orchestration.orchestration_agent import INTENT_TO_AGENTS, OrchestrationAgent, OrchestrationState


def test_resume_parse_intent_has_no_agent():
    assert INTENT_TO_AGENTS[Intent.RESUME_PARSE] == []


def _state(resume_text: str | None, memory: dict | None = None) -> OrchestrationState:
    return OrchestrationState(
        request=ChatRequest(intent="RESUME_PARSE", jobDescription="", messageHistory=[]),
        context=SessionContext(session_id=None, user_id="alice", resume_data=resume_text),
        agent_sequence=[],
        shared_memory=dict(memory or {}),
    )


def test_empty_sequence_response_returns_parsed_resume():
    resume_text = json.dumps({"name": "Alice", "skills": [{"name": "Python"}]})
    state = _state(resume_text, {"extractor_confidence_score": 0.9, "extractor_needs_review": False})

    response = OrchestrationAgent._build_empty_sequence_response(state)

    assert response is not None
    assert response.agent_name == "ResumeParser"
    assert response.content == {"resume": json.loads(resume_text)}
    assert response.confidence_score == 0.9
    assert response.needs_review is False


def test_empty_sequence_response_none_without_resume():
    state = _state(None)
    assert OrchestrationAgent._build_empty_sequence_response(state) is None


def test_empty_sequence_response_none_on_corrupt_resume():
    state = _state("{not-json")
    assert OrchestrationAgent._build_empty_sequence_response(state) is None
