from backend.app.models.llm_responses import OrchestrationResult


def test_orchestration_schema_fields():
    r = OrchestrationResult(decision="approve", confidence=0.5, details=[{"step":"a","ok":True}])
    assert r.decision == "approve"
    assert isinstance(r.details, list)
