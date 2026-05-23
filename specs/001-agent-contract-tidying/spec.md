# Feature Specification: Agent Contract Tidying

**Feature Branch**: `001-agent-contract-tidying`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: "Organize the input and outputs of all agents in @file:agents . for example, interview_coach has things like \"human_review_recommended\" while extractor has \"needs_review\". analyze all of these inputs and outputs of all agents and prepare a tidying up plan"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Standardize backend agent contracts (Priority: P1)

A backend maintainer wants a single, consistent contract for all agents so they can extend or fix agent behavior without guessing which fields are present or which metadata keys are used.

**Why this priority**: Inconsistent agent inputs and outputs cause brittle orchestration, make tests fragile, and increase the risk of hidden bugs during rollout.

**Independent Test**: Review the agent contract documentation and verify that each of the five agent classes implements the documented input schema and output schema.

**Acceptance Scenarios**:

1. **Given** the `backend/app/agents` folder, **When** a developer inspects any agent class, **Then** the agent uses a documented shared `AgentInput` contract and returns an `AgentResponse` with the same core fields.
2. **Given** `InterviewCoachAgent`, **When** it builds `sharp_metadata`, **Then** the output uses the same review recommendation semantics as the other agents.
3. **Given** `ExtractorAgent`, **When** it returns a response, **Then** it includes `needs_review` and `low_confidence_fields` in a way that is clearly aligned with the rest of the pipeline.

---

### User Story 2 - Create a unified agent I/O reference for QA (Priority: P2)

A QA engineer wants a single reference document that describes the input and output contract for each agent so they can write stable end-to-end and unit tests.

**Why this priority**: A shared reference reduces test drift, prevents contract mismatches, and makes regression coverage easier to maintain.

**Independent Test**: Generate a reference document and compare it against the actual agent models and code to confirm every field is present and behavior is described accurately.

**Acceptance Scenarios**:

1. **Given** the new agent I/O reference, **When** a QA engineer adds a test for `ContentStrengthAgent`, **Then** they can verify `suggestions`, `summary`, and `score` semantics from the reference.
2. **Given** the new reference, **When** a new agent is added, **Then** the QA engineer can follow the same contract template.

---

### User Story 3 - Align review and confidence metadata across agents (Priority: P3)

A product owner wants consistent governance signals so the orchestration layer can decide when to surface human review, show confidence, or escalate low-confidence outputs.

**Why this priority**: If review flags are inconsistent, the app may over- or under-recommend human review and produce confusing output for both users and governance dashboards.

**Independent Test**: Inspect the agent metadata contract and ensure all agent responses expose either the same review flag names or clear mapped equivalents.

**Acceptance Scenarios**:

1. **Given** an agent response, **When** the orchestration layer checks review status, **Then** it can rely on one standard field or one documented normalized alias.
2. **Given** a resume extraction response, **When** the confidence is low, **Then** `needs_review` is present and the review logic matches the metadata pattern used by other agents.
3. **Given** an interview coach response, **When** it indicates a safety or bias concern, **Then** `human_review_recommended` is present and interpreted consistently.

---

### Edge Cases

- What happens when an agent returns valid JSON content but the `AgentResponse` wrapper omits expected fields such as `confidence_score` or `sharp_metadata`?
- How should the system behave if an agent’s model output is syntactically valid JSON but semantically incompatible with the documented report schema?
- How should the plan handle the `InterviewCoachAgent` audio path versus text path when the same metadata contract is expected?
- How should review metadata be normalized if an existing agent uses `needs_review` and another uses `human_review_recommended`?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST document a shared backend `AgentInput` contract for all agents in `backend/app/models/agent.py` and in the new agent I/O reference.
- **FR-002**: The system MUST document a shared `AgentResponse` output contract with core fields: `agent_name`, `content`, `reasoning`, `confidence_score`, `decision_trace`, and `sharp_metadata`.
- **FR-003**: The system MUST define and unify governance metadata keys for review and confidence, including `needs_review` or an explicit mapped alias with consistent semantics.
- **FR-004**: The system MUST analyze all agent classes in `backend/app/agents` and capture their actual input expectations and output payloads, including `ExtractorAgent`, `ResumeCriticAgent`, `ContentStrengthAgent`, `JobAlignmentAgent`, and `InterviewCoachAgent`.
- **FR-005**: The system MUST produce a tidy plan that identifies mismatches, standardizes field names, and recommends exact changes needed to align agent outputs.
- **FR-006**: The system MUST include any agent-specific exception cases or justified deviations, and document them as deliberate contract boundaries.
- **FR-007**: The system MUST preserve external behavior for any unsupported input formats by explicitly calling out out-of-scope changes.

### Key Entities *(include if feature involves data)*

- **AgentInput**: Shared orchestrator-to-agent payload containing `intent`, `resume`, `resume_document`, `job_description`, `message_history`, and `audio_data`.
- **AgentResponse**: Shared wrapper returned by every agent with fields for `agent_name`, `content`, `reasoning`, `confidence_score`, `needs_review`, `low_confidence_fields`, `decision_trace`, and `sharp_metadata`.
- **SharpMetadata**: Governance metadata describing analysis type, confidence, review recommendation, security signals, bias flags, and other audit data.
- **ResumeExtractionPayload**: Raw resume file input for `ExtractorAgent`, with `data` as base64 PDF and `fileType: "pdf"`.
- **ReportPayload**: Agent-specific JSON content types such as `ResumeCriticReport`, `ContentStrengthReport`, `AlignmentReport`, and interview coaching JSON.
- **ReviewFlag**: A normalized signal for human-review recommendation, such as `needs_review` or `human_review_recommended`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All five backend agent classes must be covered by the new agent contract reference, with no missing documented input/output fields.
- **SC-002**: At least one standard metadata contract must be defined for review decision logic and applied consistently across all agents.
- **SC-003**: The analysis must identify and classify every mismatch between actual agent outputs and the shared contract.
- **SC-004**: The plan must list no more than one deliberate contract exception per agent and explain why it remains an exception.
- **SC-005**: QA can validate the plan by writing one test per agent that asserts the shared contract fields exist and are correctly typed.
- **SC-006**: The plan must explicitly note any agent outputs that are currently only available via `sharp_metadata` versus those available in `content`.

## Assumptions

- The cleanup is limited to backend agent contract definition and documentation, not frontend UI consumption or public API schema changes.
- Existing agent behavior is preserved unless a mismatch is a clear defect in contract consistency.
- The orchestration layer can accommodate a normalized review flag alias if exact field names differ initially.
- The plan will include both code cleanup actions and documentation updates.
- No new agent types are introduced as part of this tidying plan.
