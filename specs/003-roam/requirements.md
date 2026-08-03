# 003-roam Architecture Simplification — Requirements

Goal: simplify the current agent platform architecture while preserving product behavior, reducing coupling around interview coaching, and preparing for staged Supabase Auth + Stripe Billing integration.

Context source: `roam understand` and targeted `roam context` analysis across orchestration, registry, interview websocket, and session persistence modules.

## Problem Statement

The current system has a high-coupling interview path and in-memory session persistence that are acceptable for local development but not ideal for scalable deployment. Interview coaching is over-coupled to live websocket plumbing even though the core business need is deterministic answer evaluation based on resume + job description + rubric.

## Architecture Direction

Use a **modular monolith** (single backend deploy unit) with domain-separated agents and durable persistence.

- Frontend deployment: Vercel (or equivalent static/SSR host).
- Backend deployment: FastAPI service (single deploy unit).
- Optional async worker: extractor-heavy jobs only.
- Persistence: durable database-backed sessions/checkpoints (not in-memory only).
- Transport: interview evaluation over request/response HTTP (no websocket dependency for coaching).

## Functional Requirements

- R1: Agent domain separation
  - Agent responsibilities MUST be separated into these domains:
    - `extractor`
    - `resume_critic`
    - `content_strength`
    - `job_alignment`
    - `interview_coach`
  - Orchestration MUST route to these agents by intent without coupling interview coaching to websocket transport.

- R2: Interview coach as evaluator (non-websocket)
  - `interview_coach` MUST evaluate answers using:
    - provided resume (structured data and/or normalized text),
    - provided job description,
    - defined rubric criteria.
  - Evaluation MUST work via standard HTTP request/response endpoint(s).
  - Interview coach MUST NOT require websocket transport for correctness.

- R3: Interview API contract
  - Introduce or standardize endpoint(s) for interview answer evaluation (example: `POST /api/v1/interview/evaluate`).
  - Request MUST include enough context to score deterministically (resume context, job context, question, answer, rubric metadata).
  - Response MUST include at least:
    - score(s) by rubric dimension,
    - concise rationale/feedback,
    - actionable improvement suggestions,
    - machine-readable confidence/metadata for orchestration.

- R4: Websocket decoupling strategy
  - Existing websocket live interview path MAY remain for real-time UX but MUST be optional and isolated.
  - Real-time transport MUST call/shared-use the same evaluation core as HTTP path to avoid duplicated scoring logic.

- R5: Durable session and checkpoint persistence
  - Session state and checkpoints MUST be persisted in durable storage (database-backed) instead of in-process memory-only stores.
  - Persistence layer MUST support multi-instance backend deployments and process restarts without data loss for active sessions.

- R6: Extractor async boundary
  - Extractor-heavy operations SHOULD run through async job execution (queue/worker) when payload size or latency exceeds synchronous thresholds.
  - Non-extractor evaluation flows SHOULD remain synchronous for low latency.

- R7: Orchestration consistency
  - Orchestration logic MUST preserve current intent routing and governance checks while adopting new interview-eval API boundaries.
  - Agent registry/orchestration MUST remain the single composition point for agent construction and invocation.

- R8: Supabase Auth readiness
  - Add auth abstraction boundaries so Supabase JWT verification can be introduced without refactoring agent internals.
  - All session/artifact records MUST be attributable to a stable user identity (`user_id`) once auth is enabled.

- R9: Stripe billing readiness
  - Add entitlement checks at API/policy layer (not inside agents) to gate premium operations.
  - Billing events (webhooks) MUST map to durable subscription/entitlement records.

- R10: Observability and governance
  - Agent invocations, interview evaluation outcomes, and policy decisions MUST emit structured logs/metrics.
  - Governance/security scanning behavior MUST remain enforced after refactor.

## Data Model Requirements (for staged implementation)

The persistence model MUST support these entities (names may vary by conventions):

- users
- sessions
- session_messages
- artifacts
- rubric_scores
- subscriptions
- usage_events

## Non-Functional Requirements

- N1: Simplicity first
  - Prefer modular monolith boundaries over microservices unless validated by operational pain.

- N2: Latency
  - Interview answer evaluation endpoint SHOULD target low-latency synchronous responses suitable for interactive UX.

- N3: Reliability
  - Session continuity MUST survive backend restarts and horizontal scaling.

- N4: Security
  - Auth and entitlement checks MUST execute before protected agent operations once enabled.

- N5: Backward compatibility
  - Existing frontend flows SHOULD continue functioning during migration with transitional adapters where required.

## Explicit Decisions

- D1: Do not migrate core Python orchestration/agent execution to Vercel Functions at this stage.
- D2: Keep FastAPI as the primary backend runtime for orchestration + agents.
- D3: Treat websocket interview as optional UX transport, not required business logic transport.
- D4: Introduce Supabase Auth and Stripe Billing only after durable persistence foundations are in place.

## Out of Scope (for this spec)

- Full microservice decomposition by agent.
- Immediate production rollout of Supabase/Stripe integrations end-to-end.
- Provider-level LLM replacement unrelated to architecture simplification.

## Suggested Implementation Sequence

1. Decouple interview coaching logic from websocket endpoint and expose HTTP evaluation endpoint.
2. Migrate session/checkpoint persistence to durable storage.
3. Isolate extractor async workflow behind queue/worker boundary (if thresholds met).
4. Add auth abstraction + user identity propagation.
5. Add entitlement abstraction + Stripe webhook ingestion.
6. Remove dead coupling paths and tighten tests around orchestration and interview evaluation.

## Acceptance Criteria

- A1: Interview answer scoring works via HTTP endpoint without websocket dependencies.
- A2: Websocket path (if retained) reuses shared interview evaluation core.
- A3: Session/checkpoint data persists across process restarts.
- A4: Orchestration still routes correctly among extractor, resume critic, content strength, job alignment, and interview coach.
- A5: Auth and billing integration points exist at API/policy boundaries and do not require agent-internal changes.
- A6: Test coverage includes routing, interview evaluation, persistence continuity, and policy enforcement regressions.
