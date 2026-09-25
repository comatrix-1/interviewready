"""Unauthorized/failed upstream LLM calls must be rejected cleanly.

Regression tests for: a Gemini 401 used to be swallowed and returned as if it
were model output, eventually producing ``RuntimeError: No response produced``
and an opaque 500.
"""

import os
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

os.environ["DEBUG"] = "false"
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-api-key")

from app.agents import GeminiAuthError, GeminiError, GeminiService
from app.agents.base import BaseAgent
from app.main import app
from app.models import AgentResponse, ChatRequest
from app.models.session import SessionContext
from app.orchestration import OrchestrationAgent


class _FailingModels:
    def __init__(self, message: str):
        self._message = message

    def generate_content(self, **kwargs):
        raise RuntimeError(self._message)


def _service_with_client_error(message: str) -> GeminiService:
    service = GeminiService(api_key="test-key")
    service.client = SimpleNamespace(models=_FailingModels(message))
    return service


def test_auth_failure_raises_gemini_auth_error() -> None:
    service = _service_with_client_error("400 API key not valid. Please pass a valid API key.")

    with pytest.raises(GeminiAuthError):
        service.generate_response(system_prompt="sp", user_input="hi")


def test_403_status_raises_gemini_auth_error() -> None:
    service = _service_with_client_error("403 PERMISSION_DENIED")

    with pytest.raises(GeminiAuthError):
        service.generate_response(system_prompt="sp", user_input="hi")


def test_transient_failure_raises_gemini_error_not_auth() -> None:
    service = _service_with_client_error("500 INTERNAL - server error, please retry")

    with pytest.raises(GeminiError) as excinfo:
        service.generate_response(system_prompt="sp", user_input="hi")

    assert not isinstance(excinfo.value, GeminiAuthError)


def test_successful_call_still_returns_text() -> None:
    service = GeminiService(api_key="test-key")
    service.client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **kwargs: SimpleNamespace(text='{"ok": true}', usage_metadata=None)
        )
    )

    assert service.generate_response(system_prompt="sp", user_input="hi") == '{"ok": true}'


class _ExplodingAgent:
    """Agent whose process() always fails; used to verify single workflow pass."""

    def __init__(self):
        self.calls = 0

    def get_name(self) -> str:
        return "ResumeCriticAgent"

    def update_system_prompt(self, new_prompt: str) -> None:
        pass

    def get_system_prompt(self) -> str:
        return ""

    def process(self, input_data, context) -> AgentResponse:
        self.calls += 1
        raise RuntimeError("boom")


def test_orchestrate_runs_workflow_once_and_propagates_agent_error() -> None:


    agent = _ExplodingAgent()
    orchestrator = OrchestrationAgent(
        [agent],
        governance=__import__("app.governance", fromlist=["SharpGovernanceService"]).SharpGovernanceService(),
    )
    request = ChatRequest(intent="RESUME_CRITIC", resumeData={"skills": [{"name": "Python"}]}, jobDescription="", messageHistory=[])
    context = SessionContext(session_id="s1", user_id="u1")

    with pytest.raises(RuntimeError, match="boom"):
        orchestrator.orchestrate(request, context)

    assert agent.calls == 1


class _DummyAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            gemini_service=SimpleNamespace(model_name="test-model"),
            system_prompt="sp",
            name="DummyAgent",
        )
        self.mock_service = SimpleNamespace(generate_response=lambda **kwargs: '{"ok": true}')

    def process(self, input_data, context) -> AgentResponse:
        return AgentResponse(agent_name="DummyAgent", content={}, reasoning="", confidence_score=1.0)


def test_call_gemini_works_when_langfuse_unavailable() -> None:
    agent = _DummyAgent()
    context = SessionContext(session_id="s1", user_id="u1")

    with patch("app.agents.base.langfuse", None):
        result = agent.call_gemini("hello", context)

    assert result == '{"ok": true}'


def test_parse_endpoint_returns_503_on_upstream_auth_error() -> None:
    class _AuthFailingOrchestrator:
        def orchestrate(self, request, context):
            raise GeminiAuthError("401 Unauthorized")

    with patch(
        "app.api.v1.endpoints.analysis.get_orchestration_agent",
        return_value=_AuthFailingOrchestrator(),
    ):
        client = TestClient(app)
        response = client.post(
            "/api/v1/analysis/parse",
            headers={"X-User-Id": "alice"},
            json={"file": {"data": "JVBERi0xLjQ=", "fileType": "pdf"}},
        )

    assert response.status_code == 503
    assert "unavailable" in response.json()["detail"]
