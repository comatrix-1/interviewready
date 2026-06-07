## Codebase navigation with roam

This project uses `roam` for codebase comprehension. Always prefer roam over Glob/Grep/Read exploration.

Before modifying any code:
1. First time in the repo: `roam understand` then `roam tour`
2. Find a symbol: `roam search <pattern>`
3. Before changing a symbol: `roam preflight <name>` (blast radius + tests + fitness)
4. Need files to read: `roam context <name>` (files + line ranges, prioritized)
5. Debugging a failure: `roam diagnose <name>` (root cause ranking)
6. After making changes: `roam diff` (blast radius of uncommitted changes)

Additional commands: `roam health` (0-100 score), `roam impact <name>` (what breaks),
`roam pr-risk` (PR risk score), `roam file <path>` (file skeleton).

Run `roam --help` for all commands. Use `roam --json <cmd>` for structured output.

# Project Architecture

## Project Overview

- **Files:** 127
- **Symbols:** 1220
- **Edges:** 880
- **Languages:** python (64), json (17), markdown (16), tsx (8), typescript (7), yaml (2), css (1), html (1)

## Directory Structure

| Directory | Files | Primary Language |
|-----------|-------|------------------|
| `backend/` | 68 | python |
| `frontend/` | 27 | tsx |
| `evals/` | 16 | json |
| `.agents/` | 9 | markdown |
| `./` | 6 | markdown |
| `.github/` | 1 | yaml |

## Entry Points

- `backend/app/__init__.py`
- `backend/app/agents/__init__.py`
- `backend/app/api/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/api/v1/endpoints/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/db/__init__.py`
- `backend/app/governance/__init__.py`
- `backend/app/main.py`
- `backend/app/models/__init__.py`
- `backend/app/orchestration/__init__.py`
- `backend/app/utils/__init__.py`
- `evals/__init__.py`
- `backend/test_mock_mode.py`
- `evals/run_evals.py`

## Key Abstractions

Top symbols by importance (PageRank):

| Symbol | Kind | Location |
|--------|------|----------|
| `SessionContext class SessionContext(BaseModel)` | class | `backend/app/models/session.py:8` |
| `AgentInput class AgentInput(BaseModel)` | class | `backend/app/models/agent.py:201` |
| `Resume class Resume(BaseModel)` | class | `backend/app/models/resume.py:15` |
| `ChatRequest class ChatRequest(BaseModel)` | class | `backend/app/models/agent.py:50` |
| `InterviewCoachAgent class InterviewCoachAgent(BaseAgent)` | class | `backend/app/agents/interview_coach.py:20` |
| `AgentResponse class AgentResponse(BaseModel)` | class | `backend/app/models/agent.py:10` |
| `SharpGovernanceService class SharpGovernanceService` | class | `backend/app/governance/sharp_governance_service.py:13` |
| `JobAlignmentAgent class JobAlignmentAgent(BaseAgent)` | class | `backend/app/agents/job_alignment.py:19` |
| `ResumeCriticAgent class ResumeCriticAgent(BaseAgent)` | class | `backend/app/agents/resume_critic.py:18` |
| `ContentStrengthAgent class ContentStrengthAgent(BaseAgent)` | class | `backend/app/agents/content_strength.py:17` |
| `ExtractorAgent class ExtractorAgent(BaseAgent)` | class | `backend/app/agents/extractor.py:22` |
| `StubAgent class StubAgent` | class | `backend/tests/test_resume_input_priority.py:22` |
| `UploadStep const UploadStep = ({
  onUploadSubmit,
  rev...` | function | `frontend/components/WorkflowSteps.tsx:8` |
| `_build_live_agent def _build_live_agent(monkeypatch) -> Interview...` | function | `backend/tests/test_interview_coach.py:16` |
| `_build_agent def _build_agent(monkeypatch) -> InterviewCoach...` | function | `backend/tests/test_interview_coach.py:11` |

## Architecture

- **Dependency layers:** 8
- **Cycles (SCCs):** 2
- **Layer distribution:** L0: 991 symbols, L1: 89 symbols, L2: 53 symbols, L3: 27 symbols, L4: 25 symbols

## Testing

**Test directories:** `backend/tests/`, `frontend/tests/`
- **Test files:** 12
- **Source files:** 115
- **Test-to-source ratio:** 0.10

## Coding Conventions

Follow these conventions when writing code in this project:

- **Classes:** Use `PascalCase` (97% of 98 classes)
- **Methods:** Use `snake_case` (96% of 258 methods)
- **Imports:** Prefer absolute imports (100% are cross-directory)
- **Test files:** *.test.*, test_*.py

## Complexity Hotspots

Average function complexity: 4.6 (1000 functions analyzed)

Functions with highest complexity (consider refactoring):

| Function | Complexity | Location |
|----------|-----------|----------|
| `start_session` | 948 | `backend/app/agents/gemini_live.py:35` |
| `process` | 342 | `backend/app/agents/interview_coach.py:654` |
| `interview_live_websocket` | 157 | `backend/app/api/v1/endpoints/interview.py:69` |
| `main` | 109 | `evals/run_evals.py:343` |
| `call_gemini` | 91 | `backend/app/agents/base.py:143` |
| `call_gemini` | 91 | `backend/app/agents/base.py:520` |
| `WorkflowController` | 73 | `frontend/App.tsx:221` |
| `InterviewStep` | 61 | `frontend/components/WorkflowSteps.tsx:604` |
| `ResumePreview` | 45 | `frontend/components/ResumePreview.tsx:15` |
| `chat_endpoint` | 44 | `backend/app/api/v1/endpoints/chat.py:28` |

## Domain Keywords

- **Top domain terms:** interview, resume, agent, prompt, coach, system, session, orchestration, hallucination, confidence, payload, generate, evaluator, governance, gemini, service, orchestrator, extractor, alignment, injection

## Core Modules

Most-imported modules (everything depends on these):

| Module | Imported By | Symbols Used |
|--------|-------------|--------------|
| `backend/app/models/agent.py` | 31 files | 180 |
| `backend/app/core/config.py` | 20 files | 20 |
| `backend/app/models/session.py` | 18 files | 74 |
| `backend/app/agents/gemini_live.py` | 14 files | 16 |
| `backend/app/models/resume.py` | 11 files | 26 |
| `backend/app/orchestration/orchestration_agent.py` | 10 files | 23 |
| `backend/app/agents/gemini_service.py` | 9 files | 17 |
| `backend/app/agents/interview_coach.py` | 9 files | 19 |
| `backend/app/agents/base.py` | 8 files | 16 |
| `backend/app/utils/json_parser.py` | 8 files | 16 |