# Decouple Sessions From Analysis Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove sessions from the resume-analysis steps (PDF parse, ATS critique, alignment) so the session store is used only by the interview coach step.

**Architecture:** New session-free `/api/v1/analysis/*` endpoints (`parse`, `critique`, `alignment`) run the orchestrator with an ephemeral `SessionContext` that is never persisted, scoped by `X-User-Id` like the saved-resumes endpoints. A new `RESUME_PARSE` intent runs only the extractor (today the upload flow runs the critic and discards its output — a wasted LLM call). `POST /api/v1/chat` is tightened to accept only `INTERVIEW_COACH`, and the frontend creates its session lazily when the interview starts, seeding the session with resume + job description so the voice WebSocket relay keeps its prompt context.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy async/PostgreSQL, React 19, TypeScript, Vitest, pytest.

## Global Constraints

- After this change, sessions are used only by the interview coach step: `POST /api/v1/chat` (INTERVIEW_COACH), `/api/v1/sessions`, and `/api/v1/interview` (voice WebSocket). No other endpoint reads or writes sessions.
- New analysis endpoints are user-scoped via `resolve_user_id(request)` (`X-User-Id`, `dev-user` fallback) — identical to the saved-resumes endpoints. No session is created, read, or saved.
- The voice interview depends on the session carrying `resume_data` / `job_description` (`_build_system_instruction` in `interview.py` reads them). The frontend must seed the session explicitly when a VOICE interview starts — this behavior must not regress.
- `RESUME_PARSE` must run only the extractor/normalize stage, not the critic agent. The frontend discards the critic output from today's parse call (it re-runs the critic separately), so running it during parse is pure waste.
- Keep the manual-JSON resume flow and the saved-resumes flow working unchanged.
- Layer discipline: `api` reaches `db` only through `app/api/v1/services.py` (import-linter contract). No new import edges.
- Every task ends with its targeted tests passing, then `npm run lint:all` before committing.
- Backend endpoint tests stay hermetic with the existing `StubOrchestrator` / `_stub_stores` patterns (no live DB, no LLM).
- Run backend commands from `backend/` (`.env` loaded) or export `DATABASE_URL`/`TEST_DATABASE_URL`.

## File Structure

| File | Change |
|------|--------|
| `backend/app/models/agent.py` | Add `RESUME_PARSE` to `Intent` enum and the `ChatRequest`/`AgentInput` intent Literals |
| `backend/app/orchestration/orchestration_agent.py` | `INTENT_TO_AGENTS[RESUME_PARSE] = []`; synthesize a parse response when no agent runs |
| `backend/tests/test_orchestration_parse.py` | **Create.** Unit tests for the parse-only path |
| `backend/app/api/v1/endpoints/analysis.py` | **Create.** Session-free `parse` / `critique` / `alignment` endpoints |
| `backend/app/api/v1/api.py` | Register the `/analysis` router |
| `backend/tests/test_analysis_endpoints.py` | **Create.** Endpoint tests (stubbed orchestrator) |
| `backend/app/api/v1/endpoints/chat.py` | Reject non-`INTERVIEW_COACH` intents |
| `backend/app/api/v1/endpoints/sessions.py` | Add `POST /sessions/{id}/context` seed endpoint |
| `backend/tests/test_api_endpoints.py` | Move intent tests to the analysis endpoints; chat = interview-only; seed-endpoint tests |
| `frontend/api/analysis.ts` | **Create.** Session-free client: `parseResumeFile`, `resumeCriticAgent`, `alignmentAgent`, `hasResumeContent` |
| `frontend/api/chat-endpoints/resumeCritic.ts`, `alignment.ts` | **Delete.** Replaced by `api/analysis.ts` |
| `frontend/api/chat-endpoints/index.ts`, `interviewCoach.ts` | Point `hasResumeContent` import at `api/analysis.ts` |
| `frontend/api/session.ts` | Remove `fetchCurrentResume` (orphaned); add `seedSessionContext` |
| `frontend/providers/BackendServiceProvider.tsx` | Lazy session: remove eager init + `sessionReady`; add `ensureSession` |
| `frontend/App.tsx` | Steps 1–3 session-free; lazy session + voice seeding at interview start |
| `frontend/backendService.ts` | Legacy service: use the analysis client, drop `sessionId` from critic/alignment |
| `frontend/tests/analysis.test.ts` | **Create.** Analysis client tests |
| `frontend/tests/BackendServiceProvider.test.tsx` | **Create.** Lazy-session tests |
| `backend/README.md`, `frontend/README.md` | Document the session boundary |

---

### Task 1: Add `RESUME_PARSE` intent and the empty-sequence parse response

**Files:**
- Modify: `backend/app/models/agent.py` (Intent enum at ~line 216; `ChatRequest.intent` at ~line 55; `AgentInput.intent` at ~line 205)
- Modify: `backend/app/orchestration/orchestration_agent.py` (imports; `INTENT_TO_AGENTS` at ~line 30; `orchestrate()` at ~line 94; add staticmethod near `_update_state_memory`)
- Create: `backend/tests/test_orchestration_parse.py`

**Interfaces:**
- Consumes: `SessionContext.resume_data`, existing `OrchestrationState`, `AgentResponse`.
- Produces: `Intent.RESUME_PARSE = "RESUME_PARSE"`; `INTENT_TO_AGENTS[Intent.RESUME_PARSE] == []`; `OrchestrationAgent._build_empty_sequence_response(state: OrchestrationState) -> AgentResponse | None`. Task 2's endpoints construct `ChatRequest(intent="RESUME_PARSE", resumeFile=...)` and expect `response.content == {"resume": {...}}` (or a HITL `review_payload`).

- [ ] **Step 1: Write the failing unit tests**

Create `backend/tests/test_orchestration_parse.py`:

```python
"""Unit tests for the parse-only orchestration path (RESUME_PARSE intent)."""

import json

from app.models import AgentResponse, ChatRequest, SessionContext
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_orchestration_parse.py -v`
Expected: FAIL — `ImportError: cannot import name 'RESUME_PARSE'` (attribute does not exist yet).

- [ ] **Step 3: Add the intent to the models**

In `backend/app/models/agent.py`:

1. Extend the `Intent` enum (add it first so `ChatRequest`/`AgentInput` accept it):

```python
class Intent(StrEnum):
    RESUME_PARSE = "RESUME_PARSE"
    RESUME_CRITIC = "RESUME_CRITIC"
    CONTENT_STRENGTH = "CONTENT_STRENGTH"
    ALIGNMENT = "ALIGNMENT"
    INTERVIEW_COACH = "INTERVIEW_COACH"
```

2. Extend `ChatRequest.intent`:

```python
    intent: Literal[
        "RESUME_PARSE",
        "RESUME_CRITIC",
        "CONTENT_STRENGTH",
        "ALIGNMENT",
        "INTERVIEW_COACH",
    ]
```

3. Extend `AgentInput.intent` the same way (the second `Literal` in the file).

- [ ] **Step 4: Wire the empty sequence into the orchestrator**

In `backend/app/orchestration/orchestration_agent.py`:

1. Add the mapping (keep alphabetical grouping as in the existing dict):

```python
INTENT_TO_AGENTS = {
    Intent.RESUME_PARSE: [],
    Intent.RESUME_CRITIC: ["ResumeCriticAgent"],
    Intent.CONTENT_STRENGTH: ["ContentStrengthAgent"],
    Intent.ALIGNMENT: ["JobAlignmentAgent"],
    Intent.INTERVIEW_COACH: ["InterviewCoachAgent"],
}
```

2. In `orchestrate()`, replace the "no response" handling (currently `if not response: msg = "No response produced"; raise RuntimeError(msg)`) with:

```python
            result = self.workflow.invoke(state, config=config)
            final_state = result if isinstance(result, OrchestrationState) else None
            response = final_state.response if final_state is not None else result.get("response")

            if not response and final_state is not None:
                response = self._build_empty_sequence_response(final_state)

            if not response:
                msg = "No response produced"
                raise RuntimeError(msg)
```

3. Add the staticmethod (place it next to `_update_state_memory`):

```python
    @staticmethod
    def _build_empty_sequence_response(state: OrchestrationState) -> AgentResponse | None:
        """Synthesize a parse result when the workflow ran no agent (RESUME_PARSE).

        Returns None when there is nothing parseable so the caller's existing
        "No response produced" error still applies.
        """
        resume_text = state.context.resume_data
        if not resume_text:
            return None
        try:
            resume_dict = json.loads(resume_text)
        except json.JSONDecodeError:
            return None
        if not isinstance(resume_dict, dict) or not resume_dict:
            return None
        memory = state.shared_memory or {}
        return AgentResponse(
            agent_name="ResumeParser",
            content={"resume": resume_dict},
            reasoning="Resume parsed from uploaded file.",
            confidence_score=memory.get("extractor_confidence_score") or 1.0,
            needs_review=bool(memory.get("extractor_needs_review")),
            low_confidence_fields=list(memory.get("extractor_low_confidence_fields") or []),
            decision_trace=list(state.context.decision_trace or []),
            sharp_metadata={
                "validation_errors": list(memory.get("extractor_validation_errors") or []),
            },
        )
```

`json` is already imported at the top of the file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_orchestration_parse.py -v`
Expected: PASS (4 tests).

- [ ] **Step 6: Sanity-check the existing orchestration suites and lint**

Run: `cd backend && uv run pytest tests/test_orchestration_governance.py tests/test_resume_input_priority.py -v`
Expected: PASS (no orchestration behavior changed for existing intents).

Run: `npm run lint:all`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/agent.py backend/app/orchestration/orchestration_agent.py backend/tests/test_orchestration_parse.py
git commit -m "feat: add RESUME_PARSE intent with extract-only orchestration path"
```

---

### Task 2: Session-free analysis endpoints (parse, critique, alignment)

**Files:**
- Create: `backend/app/api/v1/endpoints/analysis.py`
- Modify: `backend/app/api/v1/api.py`
- Create: `backend/tests/test_analysis_endpoints.py`

**Interfaces:**
- Consumes: `Intent.RESUME_PARSE` (Task 1), `get_orchestration_agent()`, `resolve_user_id(request)`, `run_in_threadpool`, `ResumeFile`, `ChatRequest`, `SessionContext`.
- Produces (later used by Task 5's frontend client):
  - `POST /api/v1/analysis/parse` — body `{"file": {"data": "<base64>", "fileType": "pdf"}}` → 200 `{"resume": Resume, "needsReview": bool, "confidenceScore": float, "lowConfidenceFields": [...], "validationErrors": [...]}`, 422 when parsing fails.
  - `POST /api/v1/analysis/critique` — body `{"resume": Resume}` → 200 `{"issues": [...], "summary": str, "score": int}` (the ResumeCriticReport shape), 422 when the resume has no content.
  - `POST /api/v1/analysis/alignment` — body `{"resume": Resume, "jobDescription": str}` → 200 `{"skillsMatch": [...], "missingSkills": [...], "experienceMatch": [...], "summary": str}`, 422 when `jobDescription` is blank.

- [ ] **Step 1: Write the failing endpoint tests**

Create `backend/tests/test_analysis_endpoints.py`:

```python
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
                content={"resume": {"name": "Alice", "skills": [{"name": "Python"}]}},
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
    assert body["resume"]["name"] == "Alice"
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_analysis_endpoints.py -v`
Expected: FAIL — `ModuleNotFoundError` / 404 for `/api/v1/analysis/...` (router does not exist).

- [ ] **Step 3: Implement the endpoints**

Create `backend/app/api/v1/endpoints/analysis.py`:

```python
"""Session-free analysis endpoints (parse, critique, alignment).

These endpoints run the orchestrator with an ephemeral SessionContext that is
never persisted. The interview coach is the only step that uses sessions.
"""

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.v1.services import get_orchestration_agent, resolve_user_id
from app.core.config import settings
from app.core.limiter import limiter
from app.models import ChatRequest, Resume, SessionContext
from app.models.agent import ResumeFile

router = APIRouter()

PARSE_FAILED_DETAIL = "Failed to parse the resume file."
NO_RESUME_DETAIL = "No resume content provided."


class ParseResumeRequest(BaseModel):
    file: ResumeFile


class ParseResumeResponse(BaseModel):
    resume: Resume | None = None
    needs_review: bool = Field(alias="needsReview")
    confidence_score: float = Field(alias="confidenceScore")
    low_confidence_fields: list[str] = Field(alias="lowConfidenceFields")
    validation_errors: list[str] = Field(alias="validationErrors")

    model_config = ConfigDict(populate_by_name=True)


class CritiqueRequest(BaseModel):
    resume: Resume


class AlignmentRequest(BaseModel):
    resume: Resume
    jobDescription: str

    @field_validator("jobDescription")
    @classmethod
    def strip_and_require(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("jobDescription must not be blank")
        return v


def _extract_parse_result(
    response,
) -> tuple[Resume | None, bool, float, list[str], list[str]]:
    """Pull the parsed resume (and quality flags) out of either response shape.

    Normalize-without-review produces ``content == {"resume": {...}}``; a HITL
    review produces ``content == {"review_payload": {"extracted_data": {...}}}``.
    """
    content = response.content if isinstance(response.content, dict) else {}
    review_payload = content.get("review_payload")
    if isinstance(review_payload, dict):
        extracted = review_payload.get("extracted_data")
        if isinstance(extracted, dict):
            return (
                Resume.model_validate(extracted),
                True,
                float(review_payload.get("confidence_score") or 0.0),
                list(review_payload.get("fields_requiring_attention") or []),
                list(review_payload.get("validation_errors") or []),
            )
        return None, True, 0.0, [], []
    resume_dict = content.get("resume")
    if isinstance(resume_dict, dict):
        sharp = response.sharp_metadata or {}
        return (
            Resume.model_validate(resume_dict),
            bool(response.needs_review),
            float(response.confidence_score or 0.0),
            list(response.low_confidence_fields or []),
            list(sharp.get("validation_errors") or []),
        )
    return None, False, 0.0, [], []


@router.post("/parse")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def parse_resume(request: Request, body: ParseResumeRequest) -> ParseResumeResponse:
    """Parse an uploaded PDF into a structured resume. No session required."""
    user_id = resolve_user_id(request)
    context = SessionContext(session_id=None, user_id=user_id)
    orchestrator = get_orchestration_agent()
    internal = await run_in_threadpool(
        orchestrator.orchestrate,
        ChatRequest(
            intent="RESUME_PARSE",
            resumeFile=body.file,
            jobDescription="",
            messageHistory=[],
        ),
        context,
    )
    resume, needs_review, confidence, low_confidence, validation_errors = _extract_parse_result(internal)
    if resume is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=PARSE_FAILED_DETAIL,
        )
    return ParseResumeResponse(
        resume=resume,
        needs_review=needs_review,
        confidence_score=confidence,
        low_confidence_fields=low_confidence,
        validation_errors=validation_errors,
    )


@router.post("/critique")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def critique_resume(request: Request, body: CritiqueRequest) -> dict:
    """Critique a resume for ATS compatibility. No session required."""
    user_id = resolve_user_id(request)
    context = SessionContext(session_id=None, user_id=user_id)
    orchestrator = get_orchestration_agent()
    internal = await run_in_threadpool(
        orchestrator.orchestrate,
        ChatRequest(
            intent="RESUME_CRITIC",
            resumeData=body.resume,
            jobDescription="",
            messageHistory=[],
        ),
        context,
    )
    if internal.agent_name == "NormalizeStage":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=NO_RESUME_DETAIL,
        )
    if not isinstance(internal.content, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Critique analysis produced no result.",
        )
    return internal.content


@router.post("/alignment")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def run_alignment(request: Request, body: AlignmentRequest) -> dict:
    """Evaluate resume fit against a job description. No session required."""
    user_id = resolve_user_id(request)
    context = SessionContext(session_id=None, user_id=user_id)
    orchestrator = get_orchestration_agent()
    internal = await run_in_threadpool(
        orchestrator.orchestrate,
        ChatRequest(
            intent="ALIGNMENT",
            resumeData=body.resume,
            jobDescription=body.jobDescription,
            messageHistory=[],
        ),
        context,
    )
    if internal.agent_name == "NormalizeStage":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=NO_RESUME_DETAIL,
        )
    if not isinstance(internal.content, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Alignment analysis produced no result.",
        )
    return internal.content
```

In `backend/app/api/v1/api.py`, register the router:

```python
from app.api.v1.endpoints import agents, analysis, ats, chat, interview, resumes, sessions, users
...
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_analysis_endpoints.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Lint and commit**

Run: `npm run lint:all`
Expected: clean.

```bash
git add backend/app/api/v1/endpoints/analysis.py backend/app/api/v1/api.py backend/tests/test_analysis_endpoints.py
git commit -m "feat: add session-free analysis endpoints for parse, critique, alignment"
```

### Task 3: Tighten `/api/v1/chat` to interview-coach-only

**Files:**
- Modify: `backend/app/api/v1/endpoints/chat.py` (top of `chat_endpoint`, after `user_id = resolve_user_id(request)`)
- Modify: `backend/tests/test_api_endpoints.py` (`test_agents_and_chat`, `test_chat_rejects_other_users_session`)

**Interfaces:**
- Consumes: nothing new — the existing `chat_endpoint` signature stays.
- Produces: `POST /api/v1/chat` returns **422 with `detail` containing `"interview coach"`** for any `intent` other than `INTERVIEW_COACH`. This is the enforcement that sessions are interview-only; steps 1–3 use the Task 2 analysis endpoints instead.

- [ ] **Step 1: Write the failing tests**

In `backend/tests/test_api_endpoints.py`:

1. Replace `test_agents_and_chat` with `test_agents_and_interview_chat` (the non-interview intents move to the analysis endpoints, covered in `test_analysis_endpoints.py`):

```python
def test_agents_and_interview_chat():
    client = TestClient(app)

    r1 = client.get("/api/v1/agents")
    assert r1.status_code == 200
    assert "ResumeCriticAgent" in r1.json()

    with patch(
        "app.api.v1.endpoints.chat.get_orchestration_agent",
        return_value=StubOrchestrator(),
    ):
        interview_response = client.post(
            "/api/v1/chat",
            params={"sessionId": "s1"},
            json=_chat_request_payload("INTERVIEW_COACH"),
        )

    assert interview_response.status_code == 200
    assert isinstance(interview_response.json()["payload"], dict)


def test_chat_rejects_non_interview_intents():
    client = TestClient(app)

    for intent in ("RESUME_CRITIC", "CONTENT_STRENGTH", "ALIGNMENT"):
        response = client.post(
            "/api/v1/chat",
            params={"sessionId": "s1"},
            json=_chat_request_payload(intent),
        )
        assert response.status_code == 422
        assert "interview coach" in response.json()["detail"]
```

2. In `test_chat_rejects_other_users_session`, change both `_chat_request_payload("RESUME_CRITIC")` calls to `_chat_request_payload("INTERVIEW_COACH")` so the ownership (403) path is still exercised through a legal intent.

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `cd backend && uv run pytest tests/test_api_endpoints.py::test_chat_rejects_non_interview_intents -v`
Expected: FAIL — today the chat endpoint accepts `RESUME_CRITIC` and returns 200.

- [ ] **Step 3: Implement the intent guard**

In `backend/app/api/v1/endpoints/chat.py`, immediately after `user_id = resolve_user_id(request)`, add:

```python
    # Sessions exist only for the interview coach step. The session-free
    # /api/v1/analysis endpoints serve the other intents.
    if chat_request.intent != "INTERVIEW_COACH":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="POST /api/v1/chat is reserved for the interview coach; use /api/v1/analysis for other analyses.",
        )
```

`HTTPException` and `status` are already imported in the file.

- [ ] **Step 4: Run the endpoint tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_api_endpoints.py -v`
Expected: PASS — `test_agents_and_interview_chat`, `test_chat_rejects_non_interview_intents`, and the updated `test_chat_rejects_other_users_session` all green.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint:all`
Expected: clean.

```bash
git add backend/app/api/v1/endpoints/chat.py backend/tests/test_api_endpoints.py
```

Note: `CONTENT_STRENGTH` is now reachable only through the agents registry (it never had a UI consumer). Leave the agent registered; do not add an analysis endpoint for it.

Commit:

```bash
git commit -m "feat: restrict /api/v1/chat to the interview coach intent"
```

---

### Task 4: Session context seed endpoint (voice interview prerequisite)

**Files:**
- Modify: `backend/app/api/v1/endpoints/sessions.py`
- Modify: `backend/tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `get_or_create_session_context`, `get_session_store`, `resolve_user_id` (all already in `services.py`); `Resume` model.
- Produces: `POST /api/v1/sessions/{session_id}/context` — body `{"resumeData": Resume | null, "jobDescription": str}` → 200 `{"ok": true}`; 403 for another user's session. Persists `resume_data` (serialized) **and** `shared_memory["current_resume"]` on the session. Task 6's frontend calls this with the current resume + JD before starting a VOICE interview, so the WebSocket relay's `_build_system_instruction` still has the resume.

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_api_endpoints.py`:

```python
def test_seed_session_context_sets_resume_and_job_description():
    client = TestClient(app)
    sid = client.post("/api/v1/sessions/new", headers={"X-User-Id": "alice"}).json()["session_id"]

    response = client.post(
        f"/api/v1/sessions/{sid}/context",
        headers={"X-User-Id": "alice"},
        json={
            "resumeData": {"name": "Alice", "skills": [{"name": "Python"}]},
            "jobDescription": "SWE role",
        },
    )
    assert response.status_code == 200

    # The seeded resume is now retrievable via the existing session-resume endpoint.
    owned = client.get(f"/api/v1/sessions/{sid}/resume", headers={"X-User-Id": "alice"})
    assert owned.status_code == 200
    assert owned.json()["name"] == "Alice"


def test_seed_session_context_forbids_other_user():
    client = TestClient(app)
    sid = client.post("/api/v1/sessions/new", headers={"X-User-Id": "alice"}).json()["session_id"]

    response = client.post(
        f"/api/v1/sessions/{sid}/context",
        headers={"X-User-Id": "mallory"},
        json={"resumeData": {"name": "Alice"}},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && uv run pytest tests/test_api_endpoints.py::test_seed_session_context_sets_resume_and_job_description -v`
Expected: FAIL — 404 (route does not exist).

- [ ] **Step 3: Implement the seed endpoint**

In `backend/app/api/v1/endpoints/sessions.py`:

1. Extend the imports:

```python
import json

from pydantic import BaseModel

from app.api.v1.services import get_or_create_session_context, get_session_context, get_session_store, resolve_user_id
```

2. Add the request model after the imports:

```python
class SeedSessionContextRequest(BaseModel):
    """Resume + job description to persist on a session before a voice interview."""

    resumeData: Resume | None = None
    jobDescription: str = ""
```

3. Add the route (after `get_session_resume`):

```python
@router.post("/{session_id}/context")
@limiter.limit(settings.DEFAULT_RATE_LIMIT)
async def seed_session_context(
    request: Request,
    session_id: Annotated[str, Path()],
    body: SeedSessionContextRequest,
) -> dict:
    """Persist resume + job description on a session (used by the voice interview)."""
    user_id = resolve_user_id(request)
    try:
        context = await get_or_create_session_context(session_id=session_id, user_id=user_id)
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc

    if body.resumeData is not None:
        context.resume_data = json.dumps(body.resumeData.model_dump(exclude_none=True))
        context.shared_memory = {
            **(context.shared_memory or {}),
            "current_resume": body.resumeData.model_dump(exclude_none=True),
        }
    if body.jobDescription:
        context.job_description = body.jobDescription

    await get_session_store().save(context)
    return {"ok": True}
```

`Resume` is already imported in `sessions.py` (`from app.models.resume import Resume`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && uv run pytest tests/test_api_endpoints.py -v`
Expected: PASS (both new tests green; `_stub_stores` fixture supplies `FakeSessionStore`, no Postgres needed).

- [ ] **Step 5: Lint and commit**

Run: `npm run lint:all`
Expected: clean.

```bash
git add backend/app/api/v1/endpoints/sessions.py backend/tests/test_api_endpoints.py
git commit -m "feat: add session context seed endpoint for the voice interview"
```

### Task 5: Session-free frontend analysis client and App rewire

**Files:**
- Create: `frontend/api/analysis.ts`
- Delete: `frontend/api/chat-endpoints/resumeCritic.ts`, `frontend/api/chat-endpoints/alignment.ts`
- Modify: `frontend/api/chat-endpoints/index.ts`, `frontend/api/chat-endpoints/interviewCoach.ts`, `frontend/App.tsx`, `frontend/backendService.ts`, `frontend/api/session.ts`, `frontend/api/index.ts`
- Create: `frontend/tests/analysis.test.ts`

**Interfaces:**
- Consumes: Task 2's endpoint contracts (`/api/v1/analysis/parse|critique|alignment`).
- Produces: `frontend/api/analysis.ts` exporting `hasResumeContent(resume?)`, `parseResumeFile(authToken, {data, fileType}) -> Promise<ParseResumeResult>`, `resumeCriticAgent(authToken, resume) -> Promise<ResumeCriticReport>`, `alignmentAgent(authToken, resume, jobDescription) -> Promise<AlignmentReport>`. Existing call sites keep their function names — only the import path and `sessionId` argument change.

- [ ] **Step 1: Write the failing client tests**

Create `frontend/tests/analysis.test.ts` (same style as the saved-resume client tests in `App.test.tsx`):

```ts
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { alignmentAgent, parseResumeFile, resumeCriticAgent } from "../api/analysis";

describe("session-free analysis API client", () => {
  const AUTH_TOKEN = "test-token";

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("interviewready_username", "alice");
    globalThis.fetch = vi.fn();
  });

  it("parses a resume file via POST /api/v1/analysis/parse without a session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        resume: { name: "Alice" },
        needsReview: false,
        confidenceScore: 0.9,
        lowConfidenceFields: [],
        validationErrors: [],
      }),
    });

    const result = await parseResumeFile(AUTH_TOKEN, { data: "JVBERi0xLjQ=", fileType: "pdf" });

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(url).toEqual(expect.stringContaining("/api/v1/analysis/parse"));
    expect(String(url)).not.toContain("sessionId");
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${AUTH_TOKEN}`,
      "X-User-Id": "alice",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      file: { data: "JVBERi0xLjQ=", fileType: "pdf" },
    });
    expect(result.resume).toEqual({ name: "Alice" });
  });

  it("critiques a resume via POST /api/v1/analysis/critique without a session", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issues: [], summary: "Solid.", score: 88 }),
    });

    const report = await resumeCriticAgent(AUTH_TOKEN, { name: "Alice" } as never);

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toEqual(expect.stringContaining("/api/v1/analysis/critique"));
    expect(String(url)).not.toContain("sessionId");
    expect(JSON.parse(init?.body as string)).toEqual({ resume: { name: "Alice" } });
    expect(report.score).toBe(88);
  });

  it("runs alignment via POST /api/v1/analysis/alignment with the job description", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skillsMatch: ["Python"],
        missingSkills: [],
        experienceMatch: [],
        summary: "Good fit.",
      }),
    });

    const report = await alignmentAgent(AUTH_TOKEN, { name: "Alice" } as never, "SWE role");

    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(String(url)).toEqual(expect.stringContaining("/api/v1/analysis/alignment"));
    expect(String(url)).not.toContain("sessionId");
    expect(JSON.parse(init?.body as string)).toEqual({
      resume: { name: "Alice" },
      jobDescription: "SWE role",
    });
    expect(report.skillsMatch).toEqual(["Python"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- tests/analysis.test.ts`
Expected: FAIL — module `../api/analysis` does not exist.

- [ ] **Step 3: Implement the analysis client**

Create `frontend/api/analysis.ts`:

```ts
import type { Resume } from "../types/resume";
import type { AlignmentReport, ResumeCriticReport } from "../types/reports";
import { API_BASE_URL } from "../config/env";
import { getUserHeaders } from "../utils/identity";

const ANALYSIS_URL = `${API_BASE_URL}/api/v1/analysis`;

const authHeaders = (authToken: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${authToken}`,
  ...getUserHeaders(),
});

// Moved here from the deleted chat-endpoints/resumeCritic.ts (interviewCoach.ts imports it).
export const hasResumeContent = (resume?: Resume | null): boolean => {
  if (!resume) return false;
  return Object.values(resume).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
};

export interface ParseResumeResult {
  resume: Resume | null;
  needsReview: boolean;
  confidenceScore: number;
  lowConfidenceFields: string[];
  validationErrors: string[];
}

export const parseResumeFile = async (
  authToken: string,
  file: { data: string; fileType: "pdf" },
): Promise<ParseResumeResult> => {
  const response = await fetch(`${ANALYSIS_URL}/parse`, {
    method: "POST",
    headers: authHeaders(authToken),
    body: JSON.stringify({ file }),
  });

  if (!response.ok) {
    throw new Error(`Failed to parse resume: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ParseResumeResult;
};

export const resumeCriticAgent = async (
  authToken: string,
  resume: Resume,
): Promise<ResumeCriticReport> => {
  const response = await fetch(`${ANALYSIS_URL}/critique`, {
    method: "POST",
    headers: authHeaders(authToken),
    body: JSON.stringify({ resume }),
  });

  if (!response.ok) {
    throw new Error(`Resume critique failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as ResumeCriticReport;
};

export const alignmentAgent = async (
  authToken: string,
  resume: Resume | null | undefined,
  jobDescription: string,
): Promise<AlignmentReport> => {
  const response = await fetch(`${ANALYSIS_URL}/alignment`, {
    method: "POST",
    headers: authHeaders(authToken),
    body: JSON.stringify({ resume, jobDescription }),
  });

  if (!response.ok) {
    throw new Error(`Alignment analysis failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Partial<AlignmentReport>;
  return {
    skillsMatch: Array.isArray(data.skillsMatch) ? data.skillsMatch : [],
    missingSkills: Array.isArray(data.missingSkills) ? data.missingSkills : [],
    experienceMatch: Array.isArray(data.experienceMatch) ? data.experienceMatch : [],
    summary: typeof data.summary === "string" ? data.summary : "",
  };
};
```

- [ ] **Step 4: Delete the old chat-bound wrappers and rewire imports**

1. Delete `frontend/api/chat-endpoints/resumeCritic.ts` and `frontend/api/chat-endpoints/alignment.ts`:

```bash
rm frontend/api/chat-endpoints/resumeCritic.ts frontend/api/chat-endpoints/alignment.ts
```

2. Replace `frontend/api/chat-endpoints/index.ts` with:

```ts
export { interviewCoachAgent, sendAudioMessage } from "./interviewCoach";
```

3. In `frontend/api/chat-endpoints/interviewCoach.ts`, change the import:

```ts
import { hasResumeContent } from "../analysis";
```

(remove `import { hasResumeContent } from "./resumeCritic";`)

4. In `frontend/App.tsx`:

- Replace the import on line 8 with:

```tsx
import { createSavedResume, listSavedResumes } from "./api";
import { alignmentAgent, parseResumeFile, resumeCriticAgent } from "./api/analysis";
```

- Remove the two chat-endpoints imports (`resumeCriticAgent` from `@/api/chat-endpoints/resumeCritic`, `alignmentAgent` from `@/api/chat-endpoints/alignment`) and remove `callChatEndpoint` / `fetchCurrentResume` from the `./api` import.

- Replace `processPdfFile` (the session round-trip is gone; the parse response carries the resume):

```tsx
  const processPdfFile = async (file: File) => {
    updateProgress(25, 0);
    const base64 = await fileToBase64(file);
    updateProgress(50, 1);
    updateProgress(75, 2);
    const parsed = await parseResumeFile(authToken, { data: base64, fileType: "pdf" });
    updateProgress(90, 3);
    return parsed;
  };
```

- In `handleUploadSubmit`, replace the `processPdfFile` result handling:

```tsx
      const parsedResumeResult = await processPdfFile(file);
      const parsedResume = parsedResumeResult.resume;
      if (!parsedResume) {
        setError("Failed to parse the resume. Please try another PDF.");
        return;
      }
```

- Drop the `sessionId` argument from every `resumeCriticAgent(...)` call (four sites: `runAtsAndCritic`, `processExistingResume`, `submitManualResume`, `reRunATSCheck`) — they become `resumeCriticAgent(authToken, ...)`.

- Drop the `sessionId` argument from the `alignmentAgent(...)` call in `runAlignment` — it becomes `alignmentAgent(authToken, state.currentResume, state.jobDescription)`.

- Leave `interviewCoachAgent` / `sendAudioMessage` calls unchanged (they keep `sessionId`; Task 6 makes `sessionId` available lazily).

5. In `frontend/backendService.ts`:

- Replace the two chat-endpoints imports with:

```ts
import { alignmentAgent as alignmentService, resumeCriticAgent as resumeCriticService } from "./api/analysis";
```

- Remove `fetchCurrentResume as repoFetchCurrentResume` from the `./api` import and delete the `fetchCurrentResume()` method.

- Update the two delegating methods to drop `this.sessionId`:

```ts
  async resumeCriticAgent(resume: Resume): Promise<ResumeCriticReport> {
    return resumeCriticService(this.getAuthToken(), resume);
  }

  async alignmentAgent(resume: Resume | null | undefined, jd: string): Promise<AlignmentReport> {
    return alignmentService(this.getAuthToken(), resume, jd);
  }
```

6. In `frontend/api/session.ts`, delete the `fetchCurrentResume` function (nothing imports it after this task; the `./api` barrel re-exports via `export * from "./session"`, so no explicit export line to remove).

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd frontend && npm test -- tests/analysis.test.ts`
Expected: PASS.

Run: `cd frontend && npm run lint`
Expected: clean (tsc --noEmit).

- [ ] **Step 6: Lint and commit**

Run: `npm run lint:all`
Expected: clean.

```bash
git add frontend/api/analysis.ts frontend/api/session.ts frontend/api/index.ts frontend/api/chat-endpoints frontend/App.tsx frontend/backendService.ts frontend/tests/analysis.test.ts
git commit -m "feat: move resume analysis calls to session-free endpoints"
```

---

### Task 6: Lazy session creation and voice-interview seeding

**Files:**
- Modify: `frontend/providers/BackendServiceProvider.tsx`
- Modify: `frontend/App.tsx`
- Create: `frontend/tests/BackendServiceProvider.test.tsx`

**Interfaces:**
- Consumes: `getOrCreateSession` (unchanged, `frontend/api/session.ts`), `seedSessionContext` (added in Task 5), `useWorkflowState`.
- Produces: `BackendServiceContext` now exposes `ensureSession: () => Promise<string>` and drops `sessionReady`. `ensureSession` returns the existing session id or creates one (reusing the stored/in-flight logic in `getOrCreateSession`), returning `""` and setting `sessionError` on failure. App no longer gates rendering on `sessionReady`; the interview handlers call `ensureSession()` before starting.

- [ ] **Step 1: Write the failing provider tests**

Create `frontend/tests/BackendServiceProvider.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BackendServiceProvider, useBackendService } from "../providers/BackendServiceProvider";

afterEach(cleanup);

const Probe: React.FC = () => {
  const { sessionId, ensureSession } = useBackendService();
  return (
    <div>
      <span data-testid="session">{sessionId || "none"}</span>
      <button onClick={() => void ensureSession()}>ensure</button>
    </div>
  );
};

describe("BackendServiceProvider lazy sessions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem("authToken", "tok");
  });

  it("does not create a session on mount", () => {
    globalThis.fetch = vi.fn();
    render(
      <BackendServiceProvider>
        <Probe />
      </BackendServiceProvider>,
    );

    expect(screen.getByTestId("session").textContent).toBe("none");
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("creates the session on ensureSession and reuses it afterwards", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session_id: "session_abc" }),
    });
    const user = userEvent.setup();
    render(
      <BackendServiceProvider>
        <Probe />
      </BackendServiceProvider>,
    );

    await user.click(screen.getByText("ensure"));
    expect(await screen.findByTestId("session")).toHaveTextContent("session_abc");

    await user.click(screen.getByText("ensure"));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- tests/BackendServiceProvider.test.tsx`
Expected: FAIL — `sessionReady` still gates and `ensureSession` is undefined / the mount test fires a fetch today.

- [ ] **Step 3: Rework the provider**

In `frontend/providers/BackendServiceProvider.tsx`:

1. Remove the `sessionReady` state and the eager `useEffect` block (the whole `// Sessions are owned by the logged-in user...` effect). Remove the now-unused `useEffect` import if nothing else uses it.

2. Remove `sessionReady` from the `BackendServiceContextType` interface and from the `useMemo` value.

3. Add `ensureSession` and expose it:

```tsx
  // Sessions exist only for the interview coach step: create one lazily when the
  // interview starts instead of on app load. getOrCreateSession reuses a stored
  // session and dedupes concurrent creations.
  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId;
    setSessionError(null);
    try {
      const id = await getOrCreateSession(username || "dev-user", authToken);
      setSessionId(id);
      return id;
    } catch (err) {
      setSessionError(`Failed to initialize session: ${String(err)}`);
      return "";
    }
  }, [sessionId, username, authToken]);
```

4. Add `ensureSession` to the context type and the `useMemo` value/deps.

- [ ] **Step 4: Update App.tsx**

1. Destructure `ensureSession` instead of `sessionReady`:

```tsx
  const {
    sessionId,
    authToken,
    ensureSession,
    sessionError: sessionInitError,
    username,
    isLoggingIn,
    loginError,
    login,
    logout,
  } = useBackendService();
```

2. Replace the `sessionReady` gate in the left panel with an unconditional render:

```tsx
            <WorkflowController
              state={state}
              updateState={updateState}
              setError={setError}
              chatEndRef={chatEndRef}
              sessionId={sessionId}
              authToken={authToken}
              ensureSession={ensureSession}
            />
```

and delete the `{!sessionReady && (spinner)}` block. Add `ensureSession: () => Promise<string>` to `WorkflowController`'s props type.

3. Rework `startInterview` to create the session first, and seed the session context for VOICE mode (the WebSocket relay builds its prompt from `context.resume_data`):

```tsx
  const startInterview = async (mode: InterviewMode) => {
    setError(null);
    try {
      const id = await ensureSession();
      if (!id) throw new Error("Failed to initialize session");

      updateState((prev) => ({
        ...prev,
        interviewMode: mode,
        status: WorkflowStatus.INTERVIEWING,
        interviewHistory: [],
      }));

      if (mode === "VOICE") {
        await seedSessionContext(id, authToken, state.currentResume, state.jobDescription);
        return;
      }

      startLoading("Starting interview...", [
        "Preparing first question",
        "Personalizing coach guidance",
      ]);
      try {
        updateProgress(50, 0);
        const openingQuestion = await interviewCoachAgent(
          id,
          authToken,
          state.currentResume,
          state.jobDescription,
          [],
        );
        updateProgress(100, 1);
        updateState((prev) => ({
          ...prev,
          status: WorkflowStatus.INTERVIEWING,
          interviewHistory: [{ role: "agent", text: openingQuestion }],
        }));
      } catch (err: unknown) {
        setError(toErrorMessage(err) || "Failed to start interview");
        updateState((prev) => ({
          ...prev,
          status: WorkflowStatus.SELECTING_INTERVIEW_MODE,
          interviewHistory: [],
        }));
      } finally {
        stopLoading();
      }
    } catch (err: unknown) {
      setError(toErrorMessage(err) || "Failed to start interview");
      updateState((prev) => ({
        ...prev,
        status: WorkflowStatus.SELECTING_INTERVIEW_MODE,
        interviewHistory: [],
      }));
    }
  };
```

`seedSessionContext` is imported from `./api` (it lives in `frontend/api/session.ts`). Note: the inner `startLoading(...)`/`stopLoading()` block is unchanged from the current code — the only structural additions are the `ensureSession()` call and the VOICE seeding branch.

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd frontend && npm test`
Expected: PASS (full frontend suite).

Run: `cd frontend && npm run lint`
Expected: clean.

- [ ] **Step 6: Lint and commit**

Run: `npm run lint:all`
Expected: clean.

```bash
git add frontend/providers/BackendServiceProvider.tsx frontend/App.tsx frontend/tests/BackendServiceProvider.test.tsx
git commit -m "feat: create sessions lazily at interview start and seed voice context"
```

### Task 7: Update documentation

**Files:**
- Modify: `backend/README.md` (Session Management section)
- Modify: `frontend/README.md` (only if it claims sessions are created on app load or used by every step)

**Interfaces:**
- Consumes: nothing from code.
- Produces: docs that describe sessions as interview-coach-only and list the new session-free analysis endpoints.

- [ ] **Step 1: Update the Session Management section in `backend/README.md`**

Locate the Session Management section (it currently reads: "Sessions are stored in PostgreSQL only (via `app/db/session_store.py`); there is no in-memory fallback, and `DATABASE_URL` is required to start the app. Context is hydrated from the database on each request and persisted after a successful chat orchestration (`save()`); the `sessions` table is swept of expired rows on session creation. State from a *failed* chat request is not persisted."). Replace it with:

```markdown
Sessions are stored in PostgreSQL only (via `app/db/session_store.py`) and are used exclusively by the interview coach step: `POST /api/v1/chat` (INTERVIEW_COACH intent), the `/api/v1/sessions` endpoints, and the `/api/v1/interview` voice WebSocket relay. The upload/parse, ATS critique, and job-alignment steps use the session-free `/api/v1/analysis` endpoints and never touch sessions. `DATABASE_URL` is required to start the app. Context is hydrated from the database on each request and persisted after a successful chat orchestration (`save()`); the `sessions` table is swept of expired rows on session creation. State from a *failed* chat request is not persisted.
```

- [ ] **Step 2: Document the analysis endpoints in `backend/README.md`**

Add the following table to the API section (next to the chat/session endpoint docs; if the README has no endpoint list, add this block under a new `### Analysis endpoints (session-free)` heading):

```markdown
### Analysis endpoints (session-free)

These endpoints never read or write sessions; they scope data by `X-User-Id` like the saved-resumes endpoints.

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/analysis/parse` | Parse an uploaded PDF into structured `Resume` JSON (body: `{"file": {"data": "<base64>", "fileType": "pdf"}}`) |
| `POST /api/v1/analysis/critique` | ATS/resume critique (body: `{"resume": {...}}`) |
| `POST /api/v1/analysis/alignment` | Job alignment (body: `{"resume": {...}, "jobDescription": "..."}`) |
```

- [ ] **Step 3: Check `frontend/README.md` for stale session claims**

Run: `grep -n -i "session" frontend/README.md`
If it describes a session being created on app load or used by every workflow step, correct that text to say sessions are created lazily when the interview starts. If it has no such claim, make no change.

- [ ] **Step 4: Lint and commit**

Run: `npm run lint:all`
Expected: clean (docs-only changes should not affect it).

```bash
git add backend/README.md frontend/README.md
git commit -m "docs: describe sessions as interview-coach-only and the session-free analysis endpoints"
```

---

### Task 8: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the linter**

Run from repo root: `npm run lint:all`
Expected: clean (ESLint, tsc via `vp check`, Ruff, import-linter).

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && uv run pytest -v`
Expected: PASS. Integration suites that need Postgres (`test_db_models.py`, `test_resume_store.py`, `test_session_store.py`) use `TEST_DATABASE_URL` and skip without it; the endpoint tests are hermetic. If `test_agents.py` / `test_security.py` / `test_mock_mode.py` fail, they are calling intents the same way as before (they do not hit `/api/v1/chat`) — investigate only if they touch the changed files.

- [ ] **Step 3: Run the full frontend suite and typecheck**

Run: `cd frontend && npm test`
Expected: PASS.

Run: `cd frontend && npm run lint`
Expected: clean.

- [ ] **Step 4: Manual API smoke test**

Run: `cd backend && uv run python -c "import app.main"` — app starts (uses the real `DATABASE_URL`).

Then, with the backend running (`npm run dev` or `uvicorn app.main:app`):

```bash
curl -s -X POST localhost:8000/api/v1/analysis/alignment \
  -H "X-User-Id: alice" -H "Content-Type: application/json" \
  -d '{"resume": {"skills": [{"name": "Python"}]}, "jobDescription": "Backend engineer"}' \
  -o /dev/null -w "%{http_code}\n"
# Expected: 200 (no sessionId needed)

curl -s -X POST "localhost:8000/api/v1/chat?sessionId=s1" \
  -H "Content-Type: application/json" \
  -d '{"intent": "RESUME_CRITIC", "resumeData": {"skills": [{"name": "Python"}]}, "jobDescription": "", "messageHistory": []}' \
  -o /dev/null -w "%{http_code}\n"
# Expected: 422 (chat is interview-only)
```

- [ ] **Step 5: Confirm no session references remain in steps 1-3 frontend flow**

Run from `frontend/`: `grep -rn "fetchCurrentResume\|sessionId" api/analysis.ts api/chat-endpoints/ App.tsx | grep -v InterviewStep`
Expected: matches only in `App.tsx` interview handlers (startInterview/interviewCoach/sendAudioMessage) and `chat-endpoints/interviewCoach.ts` — none in `api/analysis.ts`.

- [ ] **Step 6: Final review**

Run a `requesting-code-review` pass over the diff: confirm no endpoint/service signature that the interview step depends on changed, `DatabaseSessionStore` is untouched, and the analysis endpoints never call `get_session_store()`.

## Self-Review

1. **Spec coverage:** The user asked to separate step-1 API calls into dedicated endpoints and keep sessions only for the interview coach. Task 2 creates the dedicated session-free endpoints (parse replaces the chat+resume round-trip; critique and alignment are also session-free since the frontend calls them from steps 1-3); Task 3 enforces the boundary on `/api/v1/chat`; Task 4 keeps the voice interview working by seeding session context; Tasks 5-6 rewire the frontend (session-free steps 1-3, lazy session at interview start). ✔
2. **Placeholder scan:** Every step has concrete code or exact commands; no TBDs. ✔
3. **Type consistency:** `parseResumeFile`/`resumeCriticAgent`/`alignmentAgent` are defined in Task 5 and consumed by App.tsx and backendService.ts with matching signatures; `ensureSession: () => Promise<string>` is produced by Task 6 and consumed by App.tsx; the backend `ParseResumeResponse` aliases (`needsReview`, `confidenceScore`, `lowConfidenceFields`, `validationErrors`) match the frontend `ParseResumeResult` field names; `Intent.RESUME_PARSE` is added in Task 1 and used by Task 2. ✔
4. **Deferred/out-of-scope, noted deliberately:** `CONTENT_STRENGTH` becomes reachable only via the agents registry (no UI consumer; documented in Task 3). The legacy `backendService.ts` class keeps its public surface but delegates to the session-free client. The `GET /api/v1/sessions/{id}/resume` endpoint stays (the seed endpoint now feeds it; it is no longer called by the frontend but is covered by the seed test).

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-12-decouple-sessions-from-analysis-steps.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
