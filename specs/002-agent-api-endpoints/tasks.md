# Tasks: Agent API Endpoints (Remove Checkpointers)

**Input**: Design documents from `/specs/002-agent-api-endpoints/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are MANDATORY. Write tests FIRST and ensure they FAIL before implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare test scaffolding to enable TDD for endpoints

- [ ] T001 [P] Create backend/tests/integration/conftest.py with TestClient fixture for app (backend/app/main.py)
- [ ] T002 [P] Create backend/tests/contract/__init__.py and backend/tests/integration/__init__.py for test discovery

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T003 Implement cached single-agent getters in backend/app/api/v1/services.py (get_resume_critic_agent, get_content_strength_agent, get_job_alignment_agent, get_extractor_agent)
- [ ] T004 [P] Update backend/app/api/v1/api.py to include new routers: resume_critic, content_strength, alignment, extractor
- [ ] T005 Align global request size limit to 1 MB in backend/app/main.py (MAX_REQUEST_SIZE = 1 * 1024 * 1024)
- [ ] T006 [P] Ensure consistent error responses; add backend/app/core/errors.py with helper to format { code, message, details? } and use in new endpoints
- [ ] T007 Configure rate limiting decorators on new endpoints using settings.DEFAULT_RATE_LIMIT

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Call resume critic directly (Priority: P1) 🎯 MVP

**Goal**: POST resume to dedicated endpoint and receive structured critique without orchestration

**Independent Test**: POST /api/v1/resume-critic/analyze returns 200 with fields summary, issues, recommendations/score; 400/422 on invalid payload

### Tests (write first)

- [ ] T008 [P] [US1] Contract test for /api/v1/resume-critic/analyze in backend/tests/contract/test_resume_critic_contract.py
- [ ] T009 [P] [US1] Integration tests for success and validation errors in backend/tests/integration/test_resume_critic_api.py

### Implementation

- [ ] T010 [P] [US1] Create endpoint module backend/app/api/v1/endpoints/resume_critic.py with POST /analyze
- [ ] T011 [US1] Map request to SessionContext + AgentInput and invoke ResumeCriticAgent via services.get_resume_critic_agent()
- [ ] T012 [US1] Add observability (Langfuse span), limiter, and consistent error formatting

**Checkpoint**: User Story 1 fully functional and independently testable

---

## Phase 4: User Story 2 - Analyze content strength (Priority: P1)

**Goal**: POST resume to Content Strength endpoint and receive scores and suggestions

**Independent Test**: POST /api/v1/content-strength/analyze returns 200 with score and suggestions; 422 on too-short input

### Tests (write first)

- [ ] T013 [P] [US2] Contract test for /api/v1/content-strength/analyze in backend/tests/contract/test_content_strength_contract.py
- [ ] T014 [P] [US2] Integration tests for success and validation errors in backend/tests/integration/test_content_strength_api.py

### Implementation

- [ ] T015 [P] [US2] Create endpoint module backend/app/api/v1/endpoints/content_strength.py with POST /analyze
- [ ] T016 [US2] Map request to SessionContext + AgentInput and invoke ContentStrengthAgent via services.get_content_strength_agent()
- [ ] T017 [US2] Add observability, limiter, and consistent error formatting

**Checkpoint**: User Story 2 fully functional and independently testable

---

## Phase 5: User Story 3 - Evaluate job alignment (Priority: P2)

**Goal**: POST resume + job description and receive alignment score and suggestions

**Independent Test**: POST /api/v1/alignment/evaluate returns alignment score, gaps, suggestions; missing jobDescription yields validation error

### Tests (write first)

- [ ] T018 [P] [US3] Contract test for /api/v1/alignment/evaluate in backend/tests/contract/test_alignment_contract.py
- [ ] T019 [P] [US3] Integration tests for success and missing-field errors in backend/tests/integration/test_alignment_api.py

### Implementation

- [ ] T020 [P] [US3] Create endpoint module backend/app/api/v1/endpoints/alignment.py with POST /evaluate
- [ ] T021 [US3] Map request to SessionContext + AgentInput and invoke JobAlignmentAgent via services.get_job_alignment_agent()
- [ ] T022 [US3] Add observability, limiter, and consistent error formatting

**Checkpoint**: User Story 3 fully functional and independently testable

---

## Phase 6: User Story 4 - Extract structured fields (Priority: P2)

**Goal**: POST document to Extractor endpoint and receive structured fields with confidence

**Independent Test**: POST /api/v1/extractor/analyze returns structured fields; low-confidence/partial outputs for unrecognizable formats

### Tests (write first)

- [ ] T023 [P] [US4] Contract test for /api/v1/extractor/analyze in backend/tests/contract/test_extractor_contract.py
- [ ] T024 [P] [US4] Integration tests for resumeData vs resumeFile payloads and invalid content types in backend/tests/integration/test_extractor_api.py

### Implementation

- [ ] T025 [P] [US4] Create endpoint module backend/app/api/v1/endpoints/extractor.py with POST /analyze
- [ ] T026 [US4] Map request to SessionContext + AgentInput and invoke ExtractorAgent via services.get_extractor_agent(); validate supported content types
- [ ] T027 [US4] Add observability, limiter, and consistent error formatting

**Checkpoint**: User Story 4 fully functional and independently testable

---

## Phase 7: User Story 5 - Interview coaching session (agentic) (Priority: P3)

**Goal**: Ensure dedicated Interview Coach endpoints remain agentic and independent from other agents

**Independent Test**: GET /api/v1/interview/token with sessionId returns model + instruction; live WebSocket functions for at least one turn

### Tests (write first)

- [ ] T028 [P] [US5] Integration smoke test for GET /api/v1/interview/token in backend/tests/integration/test_interview_token.py

### Implementation

- [ ] T029 [US5] Verify no checkpointers affect interview endpoints; document verification in comments in backend/app/api/v1/endpoints/interview.py

**Checkpoint**: User Story 5 verified without regressions

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Validate specs/002-agent-api-endpoints/quickstart.md examples against running server; update examples if needed
- [ ] T031 Add Langfuse span names for each new endpoint and ensure metadata includes endpoint and method in backend/app/api/v1/endpoints/*.py
- [ ] T032 [P] Performance smoke check: confirm non-agentic endpoints meet p95 ≤ 2.0s at nominal load; capture notes in specs/002-agent-api-endpoints/research.md
- [ ] T033 Review logging for sensitive data redaction and consistency in backend/app/core/logging.py and usage in endpoints

---

## Dependencies & Execution Order

- Setup (Phase 1): No dependencies
- Foundational (Phase 2): Depends on Setup; BLOCKS all user stories
- User Stories: Start after Foundational
  - US1 (P1) and US2 (P1) can proceed in parallel
  - US3 (P2) and US4 (P2) can proceed in parallel after Foundational (and independent of US1/US2)
  - US5 (P3) can be validated independently once Foundational is complete
- Polish: After target user stories complete

## Parallel Execution Examples

- Parallelize tests for US1 and US2 (T008/T009 and T013/T014)
- Implement endpoints in parallel across different files: resume_critic.py (T010) and content_strength.py (T015)
- Run contract tests in parallel across all endpoints once foundational wiring is done

## Implementation Strategy

- MVP: Complete US1 (Resume Critic) after Setup + Foundational, then pause for validation/demo
- Incremental: Add US2 → validate → Add US3/US4 in parallel → validate → verify US5
