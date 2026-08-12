import os
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

os.environ["DEBUG"] = "false"
os.environ.setdefault("GEMINI_API_KEY", "test-gemini-api-key")

from app.db.resume_store import ResumePersistenceUnavailableError, SavedResumeRecord
from app.main import app
from app.models import AgentResponse, ChatRequest, Resume, Skill


class StubOrchestrator:
    """Deterministic orchestrator stub for endpoint schema tests."""

    def orchestrate(self, request: ChatRequest, context) -> AgentResponse:
        if request.intent == "RESUME_CRITIC":
            payload = {
                "score": 88,
                "readability": "Clear and concise.",
                "formattingRecommendations": ["Align dates consistently."],
                "suggestions": ["Add more quantified impact."],
            }
            return AgentResponse(
                agent_name="ResumeCriticAgent",
                content=payload,
            )
        if request.intent == "CONTENT_STRENGTH":
            payload = {
                "skills": [
                    {
                        "name": "Python",
                        "category": "Technical",
                        "confidenceScore": 0.9,
                        "evidenceStrength": "HIGH",
                        "evidence": "Built ETL pipelines.",
                    }
                ],
                "achievements": [
                    {
                        "description": "Reduced latency by 25%.",
                        "impact": "HIGH",
                        "quantifiable": True,
                        "confidenceScore": 0.8,
                        "originalText": "Improved performance.",
                    }
                ],
                "suggestions": [
                    {
                        "original": "Worked on APIs",
                        "suggested": "Designed REST APIs serving 10k rps",
                        "rationale": "Adds scale and impact",
                        "faithful": True,
                        "confidenceScore": 0.7,
                    }
                ],
                "hallucinationRisk": 0.1,
                "summary": "Strong technical evidence.",
            }
            return AgentResponse(
                agent_name="ContentStrengthAgent",
                content=payload,
            )
        if request.intent == "ALIGNMENT":
            payload = {
                "skillsMatch": ["Python", "SQL"],
                "missingSkills": ["Kubernetes"],
                "experienceMatch": "Strong backend alignment.",
                "fitScore": 82,
                "reasoning": "Most core skills are present.",
                "sources": [],
            }
            return AgentResponse(
                agent_name="JobAlignmentAgent",
                content=payload,
            )

        return AgentResponse(
            agent_name="InterviewCoachAgent",
            content={"question": "Tell me about a challenging project you delivered end-to-end."},
        )


def _chat_request_payload(intent: str) -> dict:
    return {
        "intent": intent,
        "resumeData": {},
        "jobDescription": "Some JD text",
        "messageHistory": [],
    }


def test_agents_and_chat():
    client = TestClient(app)

    r1 = client.get("/api/v1/agents")
    assert r1.status_code == 200
    assert "ResumeCriticAgent" in r1.json()

    with patch(
        "app.api.v1.endpoints.chat.get_orchestration_agent",
        return_value=StubOrchestrator(),
    ):
        resume_response = client.post(
            "/api/v1/chat",
            params={"sessionId": "s1"},
            json=_chat_request_payload("RESUME_CRITIC"),
        )
        content_response = client.post(
            "/api/v1/chat",
            params={"sessionId": "s1"},
            json=_chat_request_payload("CONTENT_STRENGTH"),
        )
        alignment_response = client.post(
            "/api/v1/chat",
            params={"sessionId": "s1"},
            json=_chat_request_payload("ALIGNMENT"),
        )
        interview_response = client.post(
            "/api/v1/chat",
            params={"sessionId": "s1"},
            json=_chat_request_payload("INTERVIEW_COACH"),
        )

    assert resume_response.status_code == 200
    resume_payload = resume_response.json()["payload"]
    assert {
        "score",
        "readability",
        "formattingRecommendations",
        "suggestions",
    } <= set(resume_payload.keys())

    assert content_response.status_code == 200
    content_payload = content_response.json()["payload"]
    assert {
        "skills",
        "achievements",
        "suggestions",
        "hallucinationRisk",
        "summary",
    } <= set(content_payload.keys())

    assert alignment_response.status_code == 200
    alignment_payload = alignment_response.json()["payload"]
    assert {
        "skillsMatch",
        "missingSkills",
        "experienceMatch",
        "fitScore",
        "reasoning",
    } <= set(alignment_payload.keys())

    assert interview_response.status_code == 200
    assert isinstance(interview_response.json()["payload"], dict)


def test_chat_rejects_invalid_intent():
    client = TestClient(app)

    response = client.post(
        "/api/v1/chat",
        params={"sessionId": "s-invalid"},
        json=_chat_request_payload("UNKNOWN_INTENT"),
    )

    assert response.status_code == 422


def test_login_registers_user_on_first_login():
    client = TestClient(app)

    first = client.post("/api/v1/users/login", json={"username": "alice"})
    assert first.status_code == 200
    assert first.json() == {"username": "alice", "created": True}

    second = client.post("/api/v1/users/login", json={"username": "alice"})
    assert second.status_code == 200
    assert second.json() == {"username": "alice", "created": False}


def test_login_rejects_blank_username():
    client = TestClient(app)

    blank = client.post("/api/v1/users/login", json={"username": "   "})
    assert blank.status_code == 422

    empty = client.post("/api/v1/users/login", json={"username": ""})
    assert empty.status_code == 422


def test_session_created_with_x_user_id_header():
    client = TestClient(app)

    response = client.post("/api/v1/sessions/new", headers={"X-User-Id": "alice"})
    assert response.status_code == 200
    session_id = response.json()["session_id"]

    # The session belongs to the header user, so fetching without the header (dev-user) is forbidden.
    forbidden = client.get(f"/api/v1/sessions/{session_id}/resume")
    assert forbidden.status_code == 403

    owned = client.get(f"/api/v1/sessions/{session_id}/resume", headers={"X-User-Id": "alice"})
    assert owned.status_code == 404  # session exists but has no resume yet


def test_chat_rejects_other_users_session():
    client = TestClient(app)

    response = client.post("/api/v1/sessions/new", headers={"X-User-Id": "alice"})
    session_id = response.json()["session_id"]

    # A different user (or no user) may not act on alice's session.
    stolen = client.post(
        "/api/v1/chat",
        params={"sessionId": session_id},
        headers={"X-User-Id": "mallory"},
        json=_chat_request_payload("RESUME_CRITIC"),
    )
    assert stolen.status_code == 403

    anonymous = client.post(
        "/api/v1/chat",
        params={"sessionId": session_id},
        json=_chat_request_payload("RESUME_CRITIC"),
    )
    assert anonymous.status_code == 403


def _stub_resume_store(**kwargs):
    store = MagicMock()
    store.list_for_user = AsyncMock(return_value=kwargs.get("list_result", []))
    store.create = AsyncMock(return_value=kwargs.get("create_result"))
    return patch("app.api.v1.endpoints.resumes.get_resume_store", return_value=store)


def test_list_resumes_scoped_to_header_user():
    client = TestClient(app)
    store = MagicMock()
    store.list_for_user = AsyncMock(return_value=[])
    with patch("app.api.v1.endpoints.resumes.get_resume_store", return_value=store):
        response = client.get("/api/v1/resumes", headers={"X-User-Id": "alice"})

    assert response.status_code == 200
    assert response.json() == {"resumes": []}
    store.list_for_user.assert_awaited_once_with(user_id="alice")


def test_list_resumes_returns_full_envelope():
    client = TestClient(app)
    record = SavedResumeRecord(
        id="r1",
        filename="resume.pdf",
        created_at=datetime.now(timezone.utc),  # noqa: UP017 (datetime.UTC absent in this interpreter)
        resume=Resume(skills=[Skill(name="Python")]),
    )
    with _stub_resume_store(list_result=[record]):
        response = client.get("/api/v1/resumes", headers={"X-User-Id": "alice"})

    assert response.status_code == 200
    body = response.json()["resumes"][0]
    assert body["id"] == "r1"
    assert body["filename"] == "resume.pdf"
    assert datetime.fromisoformat(body["createdAt"]) == record.created_at
    assert body["resume"] == record.resume.model_dump(mode="json")


def test_create_saved_resume_ignores_user_id_in_body():
    client = TestClient(app)
    store = MagicMock()
    store.create = AsyncMock(
        return_value=SavedResumeRecord(
            id="r1",
            filename="resume.pdf",
            created_at=datetime.now(timezone.utc),  # noqa: UP017 (datetime.UTC absent in this interpreter)
            resume=Resume(),
        )
    )
    with patch("app.api.v1.endpoints.resumes.get_resume_store", return_value=store):
        client.post(
            "/api/v1/resumes",
            headers={"X-User-Id": "alice"},
            json={
                "user_id": "mallory",
                "filename": "resume.pdf",
                "resume": {"skills": [{"name": "Python"}]},
            },
        )

    _, kwargs = store.create.await_args
    assert kwargs["user_id"] == "alice"


def test_create_saved_resume_returns_201():
    client = TestClient(app)
    created = SavedResumeRecord(
        id="r1",
        filename="resume.pdf",
        created_at=datetime.now(timezone.utc),  # noqa: UP017 (datetime.UTC absent in this interpreter)
        resume=Resume(skills=[Skill(name="Python")]),
    )
    with _stub_resume_store(create_result=created):
        response = client.post(
            "/api/v1/resumes",
            headers={"X-User-Id": "alice"},
            json={"filename": "resume.pdf", "resume": {"skills": [{"name": "Python"}]}},
        )

    assert response.status_code == 201
    assert response.json()["id"] == "r1"
    assert response.json()["filename"] == "resume.pdf"
    assert datetime.fromisoformat(response.json()["createdAt"]) == created.created_at
    assert response.json()["resume"] == created.resume.model_dump(mode="json")


def test_create_saved_resume_passes_identity_and_resume():
    client = TestClient(app)
    store = MagicMock()
    store.create = AsyncMock(
        return_value=SavedResumeRecord(
            id="r1",
            filename="resume.pdf",
            created_at=datetime.now(timezone.utc),  # noqa: UP017 (datetime.UTC absent in this interpreter)
            resume=Resume(),
        )
    )
    with patch("app.api.v1.endpoints.resumes.get_resume_store", return_value=store):
        client.post(
            "/api/v1/resumes",
            headers={"X-User-Id": "alice"},
            json={"filename": "resume.pdf", "resume": {"skills": [{"name": "Python"}]}},
        )

    _, kwargs = store.create.await_args
    assert kwargs["user_id"] == "alice"
    assert kwargs["filename"] == "resume.pdf"
    assert kwargs["resume"] == Resume(skills=[Skill(name="Python")])


def test_create_saved_resume_rejects_blank_filename():
    client = TestClient(app)
    with _stub_resume_store():
        response = client.post(
            "/api/v1/resumes",
            headers={"X-User-Id": "alice"},
            json={"filename": "   ", "resume": {"skills": [{"name": "Python"}]}},
        )

    assert response.status_code == 422


def test_saved_resumes_unavailable_persistence_is_503():
    client = TestClient(app)
    with patch(
        "app.api.v1.endpoints.resumes.get_resume_store",
        side_effect=ResumePersistenceUnavailableError(),
    ):
        response = client.get("/api/v1/resumes", headers={"X-User-Id": "alice"})

    assert response.status_code == 503
    assert response.json()["detail"] == "Saved resumes require DATABASE_URL to be configured."
