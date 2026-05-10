# Task list — Validate LLM Outputs & Repair Flow

This task list breaks work into TDD-style incremental steps. Each task is self-contained and reviewable. Follow the plan document (requirements.md + design.md).

### Task 0: Setup test fixtures and a work branch

Files:
- Create: specs/validate-llm-outputs/ (already created)
- Modify: N/A

Steps:
- [ ] Create a work branch: git checkout -b specs/validate-llm-outputs
- [ ] Add the specs files (requirements.md, design.md, task-list.md) and commit
- [ ] Push branch (optional)

---

### Task 1: Add schema module and a single schema for one agent (OrchestrationResult)

Files:
- Create: backend/app/models/llm_responses.py
- Test: backend/tests/test_llm_responses.py

Steps:
- [ ] Write failing test: backend/tests/test_llm_responses.py — assert that OrchestrationResult exists and has fields `decision: str`, `confidence: float`, `details: list`.

  ```python
  from backend.app.models.llm_responses import OrchestrationResult

  def test_orchestration_schema_fields():
      r = OrchestrationResult(decision="approve", confidence=0.5, details=[{"step":"a","ok":True}])
      assert r.decision == "approve"
  ```

- [ ] Run: pytest backend/tests/test_llm_responses.py::test_orchestration_schema_fields -v (expected: FAIL because module missing)
- [ ] Implement minimal module with Pydantic model OrchestrationResult and defaults
- [ ] Run tests, expect PASS
- [ ] Commit changes: git add backend/app/models/llm_responses.py backend/tests/test_llm_responses.py && git commit -m "feat: add OrchestrationResult schema"

---

### Task 2: Implement sanitizer helpers

Files:
- Create: backend/app/utils/llm_validation.py (start with sanitizer helpers)
- Test: backend/tests/test_llm_validation_sanitizers.py

Steps:
- [ ] Write failing tests for sanitizer behaviors: extract_json_substring, fix_single_quotes, remove_trailing_commas, balance_brackets.
- [ ] Run tests to verify failures
- [ ] Implement sanitizer helper functions as pure functions in llm_validation.py
- [ ] Run tests until PASS
- [ ] Commit: "feat: add llm response sanitizer helpers"

---

### Task 3: Implement validate_or_repair core flow (no LLM call)

Files:
- Modify/create: backend/app/utils/llm_validation.py (add validate_or_repair without LLM reformat step)
- Test: backend/tests/test_llm_validation_core.py

Steps:
- [ ] Write failing tests: validate_or_repair accepts valid JSON string -> returns parsed instance + status "ok"; accepts malformed-but-repairable string -> returns parsed instance + status "repaired".
- [ ] Implement validate_or_repair to run strict parse, then sanitizers, parse again, and return appropriate status. For now, stub reformat LLM call as not implemented.
- [ ] Run tests until PASS
- [ ] Commit: "feat: add validate_or_repair core flow"

---

### Task 4: Add deterministic reformat LLM call and integrate into validate_or_repair

Files:
- Modify: backend/app/utils/llm_validation.py (add lll_reformat helper using project's LLM client)
- Test: backend/tests/test_llm_validation_llm_reformat.py

Steps:
- [ ] Write failing tests mocking the LLM client to return a valid JSON when asked; assert validate_or_repair uses the LLM when sanitizers fail and returns status "repaired" or "ok" as appropriate.
- [ ] Implement LLM reformat helper that uses current LLM client abstraction (import existing client wrapper). The helper must send a concise prompt and parse the response.
- [ ] Run tests until PASS
- [ ] Commit: "feat: add LLM reformat step to validate_or_repair"

---

### Task 5: Add logging & metrics

Files:
- Modify: backend/app/utils/llm_validation.py (emit logs), backend/app/core/logging.py (if needed add helpers), observability instrumentation (where metrics live)
- Test: backend/tests/test_llm_validation_logging.py

Steps:
- [ ] Write tests that assert logger is called when status != "ok" and that metric increment function is called (mock metric emitter)
- [ ] Implement logging and metrics in validate_or_repair
- [ ] Run tests and commit: "chore: add logging and metrics to llm validation"

---

### Task 6: Integrate into one agent (orchestration) and add end-to-end tests

Files:
- Modify: backend/app/agents/orchestration_agent.py (or actual orchestration module path)
- Test: backend/tests/test_orchestration_integration.py

Steps:
- [ ] Write failing test: mock agent LLM response to produce malformed output; assert agent calls validate_or_repair and that code path handles repaired/default instance correctly.
- [ ] Implement integration in agent: call validate_or_repair before parsing
- [ ] Run tests until PASS
- [ ] Commit: "feat: integrate llm validation into orchestration agent"

---

### Task 7: Add CI tests and docs

Files:
- Modify: .github/workflows/ci.yml (add new test stage if needed)
- Create: docs/validate-llm-outputs.md summarizing usage

Steps:
- [ ] Ensure all new tests are included in CI
- [ ] Add a README doc describing the utility and how to add new schemas
- [ ] Commit and push

---

### Task 8: Rollout plan (manual tasks)

- [ ] Identify next agent to integrate
- [ ] Open incremental PRs per agent with reviewer suggestions
- [ ] Monitor parse_failure_count and iterate


