import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

os.environ["DEBUG"] = "false"
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-api-key")

from app.main import app
from app.models import AgentResponse, ChatRequest


class StubOrchestrator:
    """Deterministic orchestrator stub: records requests, returns intent-shaped payloads."""

    def __init__(self) -> None:
        self.seen: list[ChatRequest] = []

    def orchestrate(self, request: ChatRequest, context) -> AgentResponse:
        self.seen.append(request)
        if request.intent == "RESUME_PARSE":
            return AgentResponse(
                agent_name="ResumeParser",
                content={"resume": {"skills": [{"name": "Python"}]}},
                confidence_score=0.9,
            )
        if request.intent == "RESUME_CRITIC":
            return AgentResponse(
                agent_name="ResumeCriticAgent",
                content={"issues": [], "summary": "Solid resume.", "score": 88},
            )
        return AgentResponse(
            agent_name="JobAlignmentAgent",
            content={
                "skillsMatch": ["Python"],
                "missingSkills": [],
                "experienceMatch": ["work[0].highlights[0]"],
                "summary": "Good fit.",
            },
        )


@pytest.fixture
def stub():
    stub = StubOrchestrator()
    with patch("app.api.v1.endpoints.analysis.get_orchestration_agent", return_value=stub):
        yield stub


def test_parse_returns_resume_without_session(stub):
    client = TestClient(app)

    response = client.post(
        "/api/v1/analysis/parse",
        headers={"X-User-Id": "alice"},
        json={"file": {"data": "JVBERi0xLjQ=", "fileType": "pdf"}},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["resume"]["skills"][0]["name"] == "Python"
    assert body["needsReview"] is False
    assert body["confidenceScore"] == 0.9
    assert stub.seen[0].intent == "RESUME_PARSE"
    assert stub.seen[0].resumeFile is not None


def test_parse_rejects_unsupported_file_type(stub):
    client = TestClient(app)

    response = client.post(
        "/api/v1/analysis/parse",
        headers={"X-User-Id": "alice"},
        json={"file": {"data": "AAAA", "fileType": "docx"}},
    )

    assert response.status_code == 422


def test_critique_returns_report_without_session(stub):
    client = TestClient(app)

    response = client.post(
        "/api/v1/analysis/critique",
        headers={"X-User-Id": "alice"},
        json={"resume": {"name": "Alice", "skills": [{"name": "Python"}]}},
    )

    assert response.status_code == 200
    body = response.json()
    assert set({"issues", "summary", "score"}) <= set(body.keys())
    assert stub.seen[0].intent == "RESUME_CRITIC"
    assert stub.seen[0].resumeData is not None


def test_alignment_returns_report_without_session(stub):
    client = TestClient(app)

    response = client.post(
        "/api/v1/analysis/alignment",
        headers={"X-User-Id": "alice"},
        json={"resume": {"name": "Alice"}, "jobDescription": "SWE role"},
    )

    assert response.status_code == 200
    body = response.json()
    assert set({"skillsMatch", "missingSkills", "experienceMatch", "summary"}) <= set(body.keys())
    assert stub.seen[0].intent == "ALIGNMENT"
    assert stub.seen[0].jobDescription == "SWE role"


def test_alignment_rejects_blank_job_description(stub):
    client = TestClient(app)

    response = client.post(
        "/api/v1/analysis/alignment",
        headers={"X-User-Id": "alice"},
        json={"resume": {"name": "Alice"}, "jobDescription": "   "},
    )

    assert response.status_code == 422


def test_check_returns_ats_and_critic_in_one_call():
    client = TestClient(app)

    class CheckStub:
        def orchestrate(self, request: ChatRequest, context) -> AgentResponse:
            return AgentResponse(
                agent_name="ResumeCriticAgent",
                content={
                    "issues": [
                        {
                            "location": "work[0].highlights[0]",
                            "type": "structure",
                            "severity": "MEDIUM",
                            "description": "Bullet lacks quantified impact.",
                        }
                    ],
                    "score": 88,
                    "summary": "Solid resume.",
                },
            )

    raw = {
        "atsScore": 70,
        "sections": [],
        "detailedResults": {},
        "keywordResult": None,
        "scoreBreakdown": None,
        "criticPenalty": 8,
        "criticIssuesApplied": [
            {
                "location": "work[0].highlights[0]",
                "type": "structure",
                "severity": "MEDIUM",
                "description": "Bullet lacks quantified impact.",
            }
        ],
        "semanticScore": None,
        "validationWarnings": [],
    }
    with patch("app.api.v1.endpoints.analysis.get_orchestration_agent", return_value=CheckStub()), patch(
        "app.api.v1.endpoints.analysis.analyze_resume", return_value=raw
    ) as mock_ats:
        response = client.post(
            "/api/v1/analysis/check",
            headers={"X-User-Id": "alice"},
            json={"resume": {"name": "Alice"}, "jobDescription": "SWE role"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["ats"]["ats_score"] == 70
    assert body["critic"]["score"] == 88
    assert mock_ats.call_args.kwargs["critic_issues"] == [
        {
            "location": "work[0].highlights[0]",
            "type": "structure",
            "severity": "MEDIUM",
            "description": "Bullet lacks quantified impact.",
        }
    ]


def test_check_rejects_empty_resume():
    client = TestClient(app)

    class EmptyStub:
        def orchestrate(self, request: ChatRequest, context) -> AgentResponse:
            return AgentResponse(agent_name="NormalizeStage", content=None)

    with patch("app.api.v1.endpoints.analysis.get_orchestration_agent", return_value=EmptyStub()):
        response = client.post(
            "/api/v1/analysis/check",
            headers={"X-User-Id": "alice"},
            json={"resume": {}},
        )

    assert response.status_code == 422
