# Agent I/O Field Mapping and Normalization

Generated: 2026-05-19

Purpose: inventory actual AgentResponse fields across agents, identify mismatches, and propose a normalized contract and migration steps.

---

## Summary of findings (high level)

- Top-level boolean review flag is inconsistent:
  - `ExtractorAgent` sets top-level `needs_review` (bool).
  - `InterviewCoachAgent` sets `human_review_recommended` inside `sharp_metadata` (bool).
  - Other agents do not consistently set either field.
- `low_confidence_fields` exists as a top-level list and is produced by `ExtractorAgent` only.
- `confidence_score` semantics differ:
  - `ResumeCriticAgent` and `ContentStrengthAgent` produce integer scores 0–100.
  - `JobAlignmentAgent` and `InterviewCoachAgent` produce floats in 0.0–1.0 range.
- `sharp_metadata` is used by all agents but contains agent-specific keys; no central schema exists.
- Interview-coach-specific fields (`answer_score`, `can_proceed`) live in `sharp_metadata` and are domain-specific—keep but document.

---

## Per-agent inventory

### `ExtractorAgent`
- Top-level `AgentResponse` fields populated:
  - `content` (JSON resume dump)
  - `reasoning` (string)
  - `confidence_score` (number, computed; range: 0–100)
  - `needs_review` (bool)
  - `low_confidence_fields` (list[str])
  - `decision_trace` (list[str])
  - `sharp_metadata` (dict) includes keys: `source`, `fileType`, `extractedTextLength`, `resume_document`, `analysis_type`, `confidence_score`, `low_confidence_fields`, `validation_errors`, `needs_review`

Notes: extractor already exposes `needs_review` and `low_confidence_fields` at top-level (good), but `confidence_score` is 0–100 integer (different scale from some other agents).

Recommendation: keep `needs_review` and `low_confidence_fields` top-level. Convert `confidence_score` to normalized float 0.0–1.0 (or add an additional field `confidence_score_normalized` temporarily) depending on migration approach.

---

### `ResumeCriticAgent`
- Top-level fields populated:
  - `content` (critique JSON)
  - `reasoning` (string)
  - `confidence_score` (int 0–100)
  - `decision_trace`
  - `sharp_metadata` includes: `analysis_type`, `confidence_score`, `ats_compatibility_checked`, `locationsFiltered`

Missing: `needs_review` and `low_confidence_fields` are not set.

Recommendation: add top-level `needs_review` (false by default) when `confidence_score` below a threshold. Normalize `confidence_score` to 0.0–1.0.

---

### `ContentStrengthAgent`
- Top-level fields populated:
  - `content` (suggestions JSON)
  - `reasoning` (summary)
  - `confidence_score` (int 0–100)
  - `decision_trace`
  - `sharp_metadata` includes: `hallucinationRisk`, `overallConfidence`, `locationsFiltered`

Missing: `needs_review`, `low_confidence_fields`.

Recommendation: expose `needs_review` when `hallucinationRisk` exceeds a threshold and normalize `confidence_score` to float 0–1. Consider exposing `low_confidence_fields` if available.

---

### `JobAlignmentAgent`
- Top-level fields populated:
  - `content` (alignment JSON)
  - `reasoning` (summary)
  - `confidence_score` (float, 0.20–0.95)
  - `decision_trace`
  - `sharp_metadata` includes: `skillsMatch`, `missingSkills`, `experienceMatch`, `summary`, `agentVersion`, `locationsFiltered`

Missing: `needs_review`, `low_confidence_fields`.

Recommendation: keep `confidence_score` float; expose `needs_review` computed from `confidence_score` < threshold. Keep agent-specific metadata under `sharp_metadata`.

---

### `InterviewCoachAgent`
- Top-level fields populated:
  - `content` (JSON interview payload)
  - `reasoning` (string)
  - `confidence_score` (constant `CONFIDENCE_SCORE` e.g., 0.85)
  - `decision_trace`
  - `sharp_metadata` includes extensive governance keys and domain fields:
    - `analysis_type`, `confidence_score`, `gemini_live_available`, `method_used`, `input_type`, `current_question_number`, `total_questions`, `prompt_injection_blocked`, `prompt_injection_signals`, `agent_security_risks`, `security_mitigations`, `responsible_ai`, `sensitive_input_detected`, `sensitive_input_types`, `bias_review_required`, `bias_flags`, `human_review_recommended`, `answer_score` (optional), `can_proceed` (optional)

Notes: `human_review_recommended` exists inside `sharp_metadata` and is set based on security/bias/prompt-injection signals.

Recommendation: add a canonical top-level `needs_review` (bool) set to the same value as `sharp_metadata.human_review_recommended` to streamline orchestration checks. Keep rich governance data in `sharp_metadata`.

---

## Normalized AgentResponse contract (proposal)

Top-level `AgentResponse` fields (all agents should populate these consistently):
- `agent_name`: str
- `content`: str (JSON string or JSON-serializable payload)
- `reasoning`: str (short human-readable explanation)
- `confidence_score`: float in range [0.0, 1.0] (normalized)
- `needs_review`: bool (canonical review flag; required)
- `low_confidence_fields`: list[str] (empty list if none)
- `decision_trace`: list[str]
- `sharp_metadata`: dict[str, Any] (agent-specific governance metadata)

Notes:
- Agents that compute confidence as 0–100 MUST convert to float 0–1 before returning. Alternatively, orchestration can normalize earlier for backward compatibility.
- `needs_review` should be explicitly set by each agent (boolean) based on an agent-specific threshold, or orchestration may compute it from `confidence_score` and `sharp_metadata` signals if agents opt out.

## Recommended sharp_metadata minimal keys (best-effort common subset)
- `analysis_type`: str
- `confidence_score`: float (duplicate of top-level for easy filtering)
- `human_review_recommended`: bool
- `prompt_injection_blocked`: bool (if applicable)
- `sensitive_input_detected`: bool
- `bias_flags`: list[str]
- `locationsFiltered`: dict (counts of filtered locations)
- Agent-specific keys may remain but should be namespaced and documented.

---

## Migration and implementation plan (short)

1. Agree on `confidence_score` numeric range (prefer float 0–1). Update spec accordingly.
2. Require `needs_review` top-level boolean on every `AgentResponse`. For backwards compatibility, map `sharp_metadata.human_review_recommended` → `needs_review` in orchestration if agent omits it.
3. Update agent implementations (small diffs):
   - `ExtractorAgent`: convert `confidence_score` to float; keep `needs_review` and `low_confidence_fields` (already present).
   - `ResumeCriticAgent` and `ContentStrengthAgent`: set `needs_review` when score < threshold; convert `confidence_score` to float.
   - `JobAlignmentAgent`: add `needs_review` mapping from confidence < threshold.
   - `InterviewCoachAgent`: set top-level `needs_review = sharp_metadata['human_review_recommended']` and ensure `confidence_score` is float (already is).
4. Add normalization in orchestrator as a safety net (if agent omits `needs_review` or uses 0–100 scores).
5. Add unit tests asserting normalized contract for each agent. Create fixture generators that validate fields and ranges.

---

## Next steps

- Approve the normalization choices (confidence range: 0–1; canonical review field: `needs_review`).
- I can generate the minimal code patches to implement these changes across agents and add unit tests. Which approach do you prefer for migration?
  - Directly update each agent to return normalized values (code changes), or
  - Implement orchestration-layer normalization (less invasive) and add deprecation warnings in agent `sharp_metadata`.


