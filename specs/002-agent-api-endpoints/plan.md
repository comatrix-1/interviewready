# Implementation Plan: Agent API Endpoints (Remove Checkpointers)

**Branch**: `ats-engine` | **Date**: 2026-06-01 | **Spec**: C:\\Users\\user\\Documents\\Projects\\interviewready\\specs\\002-agent-api-endpoints\\spec.md
**Input**: Feature specification from `C:\\Users\\user\\Documents\\Projects\\interviewready\\specs\\002-agent-api-endpoints\\spec.md`

## Summary

Remove all non-essential orchestration/checkpointers and expose dedicated, public API endpoints for each backend agent: Extractor, Resume Critic, Content Strength, Job Alignment, and Interview Coach. Only Interview Coach retains agentic, multi-turn behavior; other endpoints are single-shot. Maintain existing request/response schemas and platform auth, versioning, and error formats.

## Technical Context

**Language/Version**: Python 3.11  
**Primary Dependencies**: FastAPI, Pydantic v2, SlowAPI (rate limiting), Langfuse (observability), python-dotenv  
**Storage**: N/A (no persistent storage introduced by this feature)  
**Testing**: pytest (unit + integration tests for endpoints and error handling)  
**Target Platform**: Containerized Linux; deployed to managed environment (e.g., Cloud Run)  
**Project Type**: Web service (REST-style API)  
**Performance Goals**: Non-agentic endpoints p95 ≤ 2.0s, p99 ≤ 4.0s at nominal load; Interview Coach first-turn ≤ 3.0s perceived, subsequent p95 ≤ 2.5s  
**Constraints**: Requests capped at 1 MB payload size per call for v1; consistent error copy and schema; no new rate limits beyond defaults  
**Scale/Scope**: Throughput ≥ 20 req/s sustained per non-agentic endpoint at nominal load

## Constitution Check

GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.

- Code Quality: Will follow existing structure under backend/app/api/v1 with small, focused routers per endpoint; lint/type/tests will be added in PR. PASS (plan-level)
- Testing: Plan includes unit tests for validation/errors and integration tests per endpoint; failing tests will be authored before implementation. PASS (plan-level)
- UX Consistency: Error messages and validation follow existing platform copy; no UI changes. PASS (plan-level)
- Performance: Budgets defined above and mirrored from spec; enforcement via local load checks before merge where feasible. PASS (plan-level)
- Delivery Safety: PR will include validation notes and rollback plan (retain existing /chat path until clients migrate). PASS (plan-level)

## Project Structure

### Documentation (this feature)

```text
specs/002-agent-api-endpoints/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Created by /speckit.tasks later
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── api.py
│   │       └── endpoints/
│   │           ├── agents.py
│   │           ├── chat.py            # retained for compatibility
│   │           ├── interview.py       # live coaching websocket/token
│   │           ├── resume_critic.py   # NEW (single-shot)
│   │           ├── content_strength.py# NEW (single-shot)
│   │           ├── alignment.py       # NEW (single-shot)
│   │           └── extractor.py       # NEW (single-shot)
│   ├── agents/
│   ├── models/
│   └── orchestration/
└── tests/
    ├── integration/
    │   ├── test_resume_critic_api.py
    │   ├── test_content_strength_api.py
    │   ├── test_alignment_api.py
    │   └── test_extractor_api.py
    └── contract/
        └── test_schemas_validate.py
```

**Structure Decision**: Web application with existing backend/frontend separation. Add four new endpoint modules under backend/app/api/v1/endpoints for single-shot agents; retain existing chat and interview routes. Tests live under backend/tests with integration and contract schema checks.

## Complexity Tracking

No constitutional violations anticipated; no additional complexity justifications required.
