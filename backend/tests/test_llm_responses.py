from pydantic import ValidationError
import pytest

from backend.app.models.llm_responses import OrchestrationResult, OrchestrationDetail


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
    try:
        OrchestrationResult(decision="approve", confidence=0.5, details=[{"step": "", "ok": True}])
        raise AssertionError("ValidationError not raised for empty step")
    except ValidationError:
        pass
