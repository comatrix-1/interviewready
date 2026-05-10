# Validate LLM Outputs & Repair Flow — Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

Goal: Provide a centralized, testable system for validating and repairing LLM outputs (structured responses from agents) so downstream parsing is deterministic and resilient to malformed model text.

Architecture: Centralize Pydantic schemas for each agent's expected output shapes in backend/app/models/llm_responses.py. Add a validate_or_repair utility in backend/app/utils/llm_validation.py that: (1) attempts strict parse, (2) applies lightweight sanitizers, (3) invokes a deterministic reformat prompt to the LLM when heuristics fail, and (4) returns a safe default with logged error if all else fails.

Tech Stack: Python 3.11, Pydantic (v1 or v2 as used in repo), pytest, the project's existing LLM client abstraction (used by agents), structured logging (backend/app/core/logging.py), CI (GitHub Actions).

---

Functional requirements

- R1: Each agent that returns structured data MUST have a Pydantic schema representing the expected shape.
- R2: A single utility function validate_or_repair(value: str | dict, schema: BaseModel, hint: Optional[str]) -> Tuple[model_instance, status_code] must exist. status_code ∈ {"ok","repaired","default"}.
- R3: validate_or_repair must attempt: strict parse → sanitizer heuristics (bracket balancing, remove leading/trailing junk, JSON extraction heuristics) → low-cost reformat LLM call → final fallback default.
- R4: The repair LLM prompt must be deterministic and limited in tokens; it should ask the model to re-output only the structured payload (JSON/YAML) conforming to the schema.
- R5: The system must emit logs and a metric (parse_failure_count) whenever repair or fallback occurs.
- R6: Tests: unit tests that assert the utility accepts good input, repairs common malformations, and returns safe defaults for unrecoverable inputs.

Non-functional requirements

- N1: Latency: the utility should avoid expensive re-calls. The LLM reformat step is allowed but counted as a last resort and must be tracked.
- N2: Auditability: every repaired or defaulted parse must log the original text and the chosen action (trimmed to size in logs to avoid PII leakage).
- N3: Minimal intrusion: integrate incrementally per-agent, starting with the highest-risk agents.

Success metrics

- Less than 1% runtime parse exceptions in production agent runs after rollout (tracked via parse_failure_count metric).
- All agent modules that produce structured output have schemas and use the utility within 2 sprints.

Out of scope

- End-to-end changes to the LLM provider implementation (we'll use existing client abstraction exposed to agents).
- Large refactorings of agent output formats — plan assumes current shapes are mostly stable.

Risks and mitigations

- RISK: Model keeps emitting free-form prose instead of structured payload.
  MITIGATION: strong reformat prompt + explicit schema example; add a hard timeout and fallback path.
- RISK: Overzealous sanitizer corrupts valid outputs.
  MITIGATION: sanitizer heuristics run only if strict parse fails and are conservative (trim only, bracket balancing, JSON substring extraction).

References

- Related issue: https://github.com/comatrix-1/interviewready/issues/5
- Suggested schema location: backend/app/models/llm_responses.py
- Suggested util: backend/app/utils/llm_validation.py


