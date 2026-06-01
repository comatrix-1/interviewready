# Feature Specification: Agent API Endpoints (Remove Checkpointers)

**Feature Branch**: `[created-by-hook]`
**Created**: 2026-06-01  
**Status**: Draft  
**Input**: User description: "Remove all the checkpointers and expose different API endpoints to interact with each of the backend agents: extractor, resume critic, content strength, job alignment, interview coach. The plan is to only have agentic AI for interview coach."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Call resume critic directly (Priority: P1)

As an API consumer, I can send a resume payload to a dedicated Resume Critic endpoint and receive a structured critique (strengths, weaknesses, actionable recommendations) without any orchestration or intermediate checkpointers.

**Why this priority**: This provides immediate value by enabling quick feedback loops on resume quality, a primary use case.

**Independent Test**: POST a valid resume payload to the Resume Critic endpoint and verify response includes fields: summary, issues, recommendations. No other systems required.

**Acceptance Scenarios**:

1. Given a valid resume payload, When I POST to the Resume Critic endpoint, Then I receive a 200 response with a structured critique.
2. Given a payload missing required fields, When I POST to the endpoint, Then I receive a 400 error with a clear error message and no partial processing.

---

### User Story 2 - Analyze content strength (Priority: P1)

As an API consumer, I can send a resume payload to a Content Strength endpoint and receive a quantified signal (scores by category and overall) with improvement tips.

**Why this priority**: Complements resume critique with measurable metrics that downstream experiences can visualize.

**Independent Test**: POST a valid resume payload, verify numeric scores and category breakdown are present in the response.

**Acceptance Scenarios**:

1. Given a valid resume payload, When I POST to the Content Strength endpoint, Then I receive a 200 response with scores and category breakdown.
2. Given an empty or too short resume, When I POST, Then I receive a 422-like validation error with guidance.

---

### User Story 3 - Evaluate job alignment (Priority: P2)

As an API consumer, I can submit a resume and a job description to a Job Alignment endpoint and receive an alignment score plus specific gap analysis and tailoring suggestions.

**Why this priority**: Directly supports the core value proposition of aligning resumes to jobs.

**Independent Test**: POST resume + job description, verify alignment score, gaps, and suggestions are present.

**Acceptance Scenarios**:

1. Given a valid resume and job description, When I POST to Job Alignment, Then I receive alignment score (0-100), gaps, and suggestions.
2. Given a missing job description, When I POST, Then I receive a validation error identifying the missing field.

---

### User Story 4 - Extract structured fields (Priority: P2)

As an API consumer, I can send an input document to an Extractor endpoint and receive structured fields (e.g., contact info, skills, education, experience) in a predictable schema.

**Why this priority**: Enables downstream systems to persist and reuse structured data.

**Independent Test**: POST a resume-like document, verify extracted fields and schema compliance.

**Acceptance Scenarios**:

1. Given a well-formed resume document, When I POST to Extractor, Then I receive a 200 response with key fields populated.
2. Given a document with unrecognizable format, When I POST, Then I receive a response indicating low confidence with empty or partial fields.

---

### User Story 5 - Interview coaching session (agentic) (Priority: P3)

As a user, I can initiate and continue an interview coaching session through a dedicated Interview Coach endpoint that may perform multi-step/agentic reasoning to ask questions, evaluate answers, and provide guidance.

**Why this priority**: Interview coaching is the only agentic experience retained; ensuring a dedicated path avoids coupling to other agents.

**Independent Test**: Start a session and exchange at least two turns; verify responses include coaching prompts and feedback.

**Acceptance Scenarios**:

1. Given a session start request, When I POST to Interview Coach, Then a session identifier is issued and the first coaching prompt is returned.
2. Given a follow-up user answer with a valid session id, When I POST to continue, Then I receive tailored feedback and the next prompt.

### Edge Cases

- What happens when inputs exceed maximum size limits? Responses should return a clear validation error and suggest size thresholds.
- How does system handle upstream model/service timeouts? Fail fast with a retriable error code and human-readable message; no partial side effects.
- What happens when the same request is retried? Idempotent behavior for non-session endpoints; no duplicate side effects.
- How are unsupported content types handled? Return a clear error and list supported types.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose distinct, public API endpoints for each agent: Extractor, Resume Critic, Content Strength, Job Alignment, Interview Coach.
- **FR-002**: Non-interview endpoints MUST perform single-shot processing without any orchestration or checkpointers; results are returned in one response.
- **FR-003**: Interview Coach MUST support multi-turn interactions and MAY use agentic reasoning steps internally; other agents MUST NOT.
- **FR-004**: Each endpoint MUST accept the existing request schema for its respective agent with no changes to fields or validation rules.
- **FR-005**: Each endpoint MUST return the existing response schema for its respective agent, unchanged (including error formats).
- **FR-006**: All legacy checkpointers or gating mechanisms MUST be disabled/removed for Extractor, Resume Critic, Content Strength, and Job Alignment; no request to these endpoints is blocked by checkpointers.
- **FR-007**: The API MUST provide descriptive validation errors for missing/invalid fields, including a machine-readable code and human-readable message.
- **FR-008**: The API MUST NOT introduce new rate limits or error formats as part of this refactor; existing platform limits and responses apply.
- **FR-009**: New endpoints MUST adhere to the existing API versioning strategy without introducing new versions solely for this refactor.
- **FR-010**: The Extractor endpoint MUST expose current extractor behavior and schema without modification; no changes to extracted fields or confidence scoring.
- **FR-011**: The Interview Coach endpoint MUST retain current session semantics and agentic behavior; no changes to session lifetime, turn limits, or memory.
- **FR-012**: Authentication/authorization MUST follow existing platform standards for protected APIs, reusing current mechanisms where applicable.
- **FR-013**: This refactor MUST NOT change agent logic, prompts, memory behavior, or output schemas for any agent; only endpoint exposure and removal of checkpointers are in scope.

### Non-Functional Requirements (mandatory)

- Performance Budgets: Define and agree budgets before implementation
  - API: p95 ≤ 2.0 s, p99 ≤ 4.0 s for non-agentic endpoints at nominal load; throughput ≥ 20 req/s sustained per endpoint
  - Interview coaching: first-turn response perceived within 3.0 s; subsequent turns p95 ≤ 2.5 s
  - Memory/Resource ceilings: requests capped to 1 MB payload size per call (v1)
- UX Consistency Standards: Consistent error copy and field naming across endpoints; document loading/empty/error states for clients consuming these APIs.
- Reliability: Timeouts, retries, and backpressure defined for upstream model calls; graceful degradation with clear error signaling.
- Observability: Required logs (request id, user id when available), metrics (RPS, latency percentiles, error rates), and traces for all endpoints; redaction applied for sensitive fields.

### Key Entities *(include if feature involves data)*

- **AgentRequest**: Represents a request to any agent endpoint; attributes: request_id, user_id, payload (endpoint-specific), timestamp.
- **AgentResponse**: Represents the standardized response; attributes: request_id, status (success|error), result (endpoint-specific), errors[], metadata (confidence, processing_time, notes).
- **CoachingSession**: Represents an interview coaching session; attributes: session_id, created_at, last_activity_at, turns_count, status (active|expired), context summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of non-agentic endpoint requests (Extractor, Resume Critic, Content Strength, Job Alignment) complete successfully within 2 seconds at nominal load.
- **SC-002**: 99% of non-agentic requests return a well-formed response that conforms to each agent's existing schema (schema validation passes).
- **SC-003**: 0% of requests to non-agentic endpoints are blocked by checkpointers after launch (verified via logs/metrics).
- **SC-004**: Interview coaching sessions achieve a 90% successful two-turn interaction rate without errors under nominal conditions.
- **SC-005**: Error rate (non-4xx) remains below 1% for all endpoints over a 7-day period post-launch.
- **SC-006**: Stakeholder acceptance: internal consumers confirm endpoint usability and clarity (≥ 4/5 satisfaction in developer survey).

## Assumptions

- Existing authentication/authorization mechanisms will be reused; no new auth flows are introduced for this feature.
- Supported input formats remain unchanged from current behavior (e.g., JSON and/or file uploads as currently supported).
- Existing error and response schemas will be retained across endpoints; no schema changes are introduced by this refactor.
- Orchestration/checkpointers are fully removed or bypassed for all agents except Interview Coach.
- Default rate limits mirror existing platform defaults unless explicitly updated in API policy.
