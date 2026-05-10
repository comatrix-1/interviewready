# Validate LLM Outputs & Repair Flow — Design

Overview

This design defines the components, interfaces, and flow for validating and repairing structured outputs produced by LLM-backed agents. The goal is to centralize parsing, minimize duplicated heuristics, and provide observability and test coverage for malformed model outputs.

Core components

1) Schemas: backend/app/models/llm_responses.py
   - Purpose: declare Pydantic models for each agent's structured outputs (e.g., OrchestrationResult, JobAlignmentResult, ResumeCriticResult, ContentStrengthResult).
   - Style: small atomic types, explicit required fields, descriptive field docs.

2) Validation util: backend/app/utils/llm_validation.py
   - Public API:
     - def validate_or_repair(raw: str | dict, schema: Type[BaseModel], hint: Optional[str] = None) -> Tuple[BaseModel, str]
       - Returns: (parsed_instance, status) where status in {"ok","repaired","default"}
   - Internal steps:
     a) Normalization: if raw is dict-like, try direct parse with schema.parse_obj.
     b) Strict parse: if raw is string, attempt parse using the schema (e.g., parse_raw or json.loads + parse_obj).
     c) Sanitizers: heuristics applied only if strict parse fails. Examples:
        - Trim leading/trailing text before first/after last JSON marker
        - Extract first JSON-like substring via regex (\{.*\}|\[.*\]) with greedy balancing
        - Fix common issues: trailing commas, single quotes to double quotes, unescaped newlines in strings
        - Balance brackets: add missing closing braces/brackets when safe
     d) Reformat LLM call: if sanitizers fail, send a deterministic prompt to the LLM asking it to output strictly the serialized payload conforming to the schema (JSON only). Provide a compact example in the prompt and instruct to only return the payload, no explanation.
     e) Fallback: if the reformat step fails or times out, return schema.construct(defaults) or a clearly documented safe default object.

3) Agent integration points
   - Each agent that previously parsed free-form text must call validate_or_repair before further processing.
   - Example (pseudo):

     parsed, status = validate_or_repair(response_text, OrchestrationResult)
     if status == "default":
         log.warning("LLM parse fell back to default", extra={"agent": "orchestration"})

4) Logging & metrics
   - Use backend/app/core/logging.py to log events. Include truncated original payload (200 chars) and status.
   - Increment parse_failure_count metric with labels: agent, status.

5) Tests
   - Unit tests for each sanitizer heuristics function with malformed fixtures.
   - End-to-end test that mocks LLM client to return a non-JSON string and assert validate_or_repair uses the mocked reformat response.

6) Example reformat prompt (concise)

You are given an instruction to output ONLY a valid JSON payload that conforms to the schema below. Do not return any prose, markdown, or explanation. If you cannot produce a valid payload, return an empty JSON object {}.

Schema example:
{
  "decision": "approve",
  "confidence": 0.92,
  "details": [
    {"step": "parse", "ok": true}
  ]
}

Respond with the valid JSON payload only.

Implementation notes

- Keep reformat LLM calls rate-limited and instrumented (latency + success/failure).
- Make sanitizer heuristics testable and pure functions.
- Prefer adding schema fields rather than making schemas permissive — explicit is better.

Directory and file map

- backend/app/models/llm_responses.py (new) — Pydantic models + helpers for defaults
- backend/app/utils/llm_validation.py (new) — validate_or_repair + sanitizer helpers + small internal LLM wrapper
- backend/tests/test_llm_validation.py — unit tests + fixtures
- backend/app/agents/* — integrate validate_or_repair into agents incrementally (one PR per agent)

Security & privacy

- Do not log full raw LLM outputs; truncate to 200 characters and mask obvious secrets.
- Reformat prompt must avoid injecting any PII or private data; sanitize before sending if necessary.

