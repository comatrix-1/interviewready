# CLAUDE.md

This repository implements a production-grade multi-agent AI evaluation system built with FastAPI, LangGraph, and async SQLAlchemy.

## Core Development Principles

### Make Surgical Changes
- Modify only code directly relevant to the task.
- Do not refactor unrelated modules.
- Preserve existing architecture and naming conventions.
- Do not introduce new abstractions unless they remove clear duplication or complexity.

### Prefer Simplicity
- Implement the minimum viable change.
- Avoid speculative configurability or extensibility.
- Avoid creating wrappers/helpers for single call sites.
- Match the repository’s existing patterns before introducing new ones.

### Verify Changes
Before completing work:
- Run targeted tests first, then broader tests if needed.
- Ensure linting and type checks pass for touched files.
- Validate API contract compatibility.
- Confirm imports and dead code introduced by changes are cleaned up.

### Surface Uncertainty
- State assumptions explicitly.
- If requirements are ambiguous, ask clarifying questions before implementing.
- If a requested approach conflicts with existing architecture, explain the tradeoff.

### Security Constraints
- Never bypass LLM Guard scanning.
- Never bypass governance audit flows.
- Never log raw sensitive user data.
- Preserve PII redaction behavior.

---

## Common Commands

- Install dependencies: `uv sync`
- Run backend: `uv run python -m app.main`
- Run tests: `uv run pytest`
- Run single test:
  `uv run pytest path/to/test_file.py::test_name`
- Lint/format:
  `uv run ruff check . && uv run ruff format .`
- Type check:
  `uv run mypy .`

---

## Architecture Overview

### Request Flow
1. HTTP request hits `/api/v1/chat`
2. Orchestration extracts intent and normalizes input
3. Selected agent processes request
4. Governance validates response
5. Langfuse records trace
6. Structured response returned

### Major Components

#### API Layer
- `backend/app/main.py`
- `backend/app/api/v1/endpoints/chat.py`

#### Agent Layer
Located in `backend/app/agents/`

All agents inherit from `BaseAgent`, which enforces:
- Prompt injection scanning
- Output sanitization
- Structured logging
- Langfuse tracing
- Governance integration

#### Governance Layer
- `backend/app/governance/sharp_governance_service.py`

Responsibilities:
- Confidence validation
- Hallucination detection
- Bias detection
- Human-review escalation

#### Security Layer
- `backend/app/security/`

Contains:
- LLM Guard scanner
- Output sanitization
- PII protection

---

## Development Guidance

### Testing Expectations
For bug fixes:
1. Reproduce with a failing test
2. Implement fix
3. Verify test passes

For new features:
1. Add focused tests
2. Avoid broad unrelated changes
3. Preserve response contracts

### Mock Development
Use mock agents during local development:
```bash
export MOCK_RESUME_CRITIC_AGENT=true
Observability

Use Langfuse traces to debug orchestration and agent behavior.

Structured Outputs

Maintain strict structured-output contracts for all agents.
Do not introduce free-form response schemas unless explicitly required.