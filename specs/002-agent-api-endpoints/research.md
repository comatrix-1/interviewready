# Research: Agent API Endpoints (Remove Checkpointers)

Created: 2026-06-01
Spec: C:\\Users\\user\\Documents\\Projects\\interviewready\\specs\\002-agent-api-endpoints\\spec.md

## Questions and Decisions

Decision: Endpoint exposure strategy
- Rationale: Reduce coupling to orchestration; provide clear, single-purpose endpoints that map 1:1 to agents.
- Alternatives considered:
  - Keep single /chat orchestrator and add query params for agent selection (Rejected: keeps checkpointer path and complexity)
  - Introduce a new API version for endpoints (Rejected: no schema change; follow spec to reuse current version)

Decision: Backward compatibility for /chat
- Rationale: Existing consumers may rely on /chat. Retain /api/v1/chat for now, document the new endpoints and migration path.
- Alternatives considered: Deprecate /chat immediately (Rejected: breakage risk)

Decision: Request/response schemas
- Rationale: Reuse existing models defined in backend/app/models (Resume, AgentResponse variants) to keep backward compatibility per spec.
- Alternatives considered: Tighten or rename fields (Rejected: out of scope; spec requires unchanged schemas)

Decision: Error formats and rate limits
- Rationale: Reuse current platform error structure and default rate limiting; do not introduce new formats or limits.
- Alternatives considered: Endpoint-specific rate limits (Rejected: spec forbids new limits as part of this refactor)

Decision: Payload size limit (1 MB)
- Rationale: Spec defines 1 MB cap for v1. Current app middleware allows ~20 MB; align middleware to 1 MB for these endpoints and document limits.
- Alternatives considered: Keep 20 MB (Rejected: violates spec; larger payloads increase cost and latency)

Decision: Versioning
- Rationale: Remain under /api/v1 without creating new versions; no schema changes.
- Alternatives considered: /api/v2 (Rejected: unnecessary per spec)

## Integrations & Dependencies

- Upstream LLM service via existing agent implementations (GeminiService/MockGeminiService)
- Observability via Langfuse client already wired in project
- Rate limiting via SlowAPI (existing configuration)

## Patterns & Best Practices

- Single responsibility endpoints: each route invokes a single agent synchronously and returns its mapped schema
- Idempotency for non-session endpoints: ensure no server-side state is mutated
- Validation: leverage Pydantic models; consistent 4xx on validation failures
- Timeouts/backpressure: apply conservative timeouts on agent calls; return clear retriable error on timeout

## Open Risks and Mitigations

- Risk: Clients misuse /chat and new endpoints simultaneously
  - Mitigation: Document guidance in quickstart; add basic warning logs if both used in same session
- Risk: Performance regression under load
  - Mitigation: Add simple load test locally before merge; monitor p95/p99 post-launch

