# Data Model: Agent API Endpoints (Remove Checkpointers)

Created: 2026-06-01

## Entities

1) AgentRequest
- Purpose: Envelope describing an incoming API call to a single-shot agent
- Fields:
  - request_id: string (generated per request)
  - user_id: string (optional, from auth/session)
  - payload: object (agent-specific)
  - timestamp: ISO-8601 string

2) AgentResponse
- Purpose: Standardized response wrapper used across agents
- Fields:
  - request_id: string
  - status: enum [success, error]
  - result: object (agent-specific)
  - errors: array of { code: string, message: string, field?: string }
  - metadata: object { confidence?: number, processing_time_ms?: number, notes?: string }

3) CoachingSession (Interview Coach only)
- Purpose: Maintain conversational session across turns (agentic path only)
- Fields:
  - session_id: string
  - created_at: ISO-8601 string
  - last_activity_at: ISO-8601 string
  - turns_count: integer
  - status: enum [active, expired]
  - context_summary: string (brief)

## Validation Rules

- Resume payload must include sufficient text content to analyze (min length guidance for 422)
- Job alignment requires both resume and job_description; job_description non-empty
- Extractor accepts resume-like content (text or file) and returns structured fields with confidence
- Interview Coach uses session_id and message history; multi-turn semantics unchanged

## Relationships

- AgentRequest.request_id = AgentResponse.request_id (correlation)
- CoachingSession.session_id is used only for Interview Coach endpoints and websocket

## State Transitions (Interview Coach)

- created -> active (on first message)
- active -> expired (idle timeout or explicit close)

