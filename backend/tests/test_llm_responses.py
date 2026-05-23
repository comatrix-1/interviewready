from pydantic import ValidationError
import importlib.util
import pathlib
import pytest

# Load the model module directly from file to avoid importing the whole `backend` package
# which pulls many optional dependencies during package import.
here = pathlib.Path(__file__).resolve().parents[1]  # backend/tests/.. -> backend
module_path = here / "app" / "models" / "llm_responses.py"
spec = importlib.util.spec_from_file_location("llm_responses", module_path)
llm_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(llm_mod)

OrchestrationResult = llm_mod.OrchestrationResult
OrchestrationDetail = llm_mod.OrchestrationDetail


def test_orchestration_schema_fields():
    # Construct from primitives (dicts) and ensure details are parsed into model instances
    r = OrchestrationResult(decision="approve", confidence=0.5, details=[{"step": "a", "ok": True}])
    assert r.decision == "approve"
    assert isinstance(r.details, list)
    # Each item should be an OrchestrationDetail instance
    assert all(isinstance(d, OrchestrationDetail) for d in r.details)


def test_details_reject_unknown_fields():
    # Unknown/extra fields in detail items should raise a ValidationError due to extra=forbid
    with pytest.raises(ValidationError):
        # passing an extra field 'unexpected' should fail validation
        OrchestrationResult(decision="approve", confidence=0.5, details=[{"step": "a", "ok": True, "unexpected": 1}])


def test_empty_step_rejected():
    # An empty step string should be rejected (min_length=1)
    with pytest.raises(ValidationError):
        OrchestrationResult(decision="approve", confidence=0.5, details=[{"step": "", "ok": True}])
