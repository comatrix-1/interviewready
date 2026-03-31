# AI-Based Governance Architecture

## Overview

The platform now implements a AI-driven governance layer that replaces hardcoded pattern matching with semantic intelligence. This document outlines the architecture, services, and integration patterns.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│           Agent Response                                 │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴────────────────┐
         │ SharpGovernanceService     │
         │ (Orchestrator)             │
         └───────────┬────────────────┘
         │
    ┌────┴──────┬───────────────┬──────────────────────────┐
    │            │               │                          │
    ▼            ▼               ▼                          ▼
┌─────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  BIAS   │ │HALLUCINATION │ │EXPLAINABILITY│ │ TRADITIONAL SHARP│
│DETECTION│ │  EVALUATION  │ │  SERVICE     │ │   (Confidence,   │
│SERVICE  │ │  SERVICE     │ │              │ │  Quantifiable)   │
└──┬──────┘ └────────┬─────┘ └──────┬───────┘ └────────┬─────────┘
   │                 │              │                   │
   │ Results:        │ Results:     │ Results:         │ Results:
   │ •Attributes     │ •Risk score  │ •Attribution     │ •Flags
   │ •Bias signals   │ •Faithfulness│ •Transparency    │ •Metadata
   │ •Fairness       │ •Contradicts │ •Explanation     │
   │  concerns       │              │                  │
   │ •Risk score     │              │                  │
   │                 │              │                  │
   └─────────────────┴──────────────┴──────────────────┴─────────┘
                     │
        ┌────────────┴─────────────┐
        │  Langfuse Trace Update   │
        │  (Merged Metadata)       │
        └─────────────────────────┘
```

## Service Components

### 1. BiasDetectionService

**Location**: `backend/app/governance/bias_detection_service.py`

**Purpose**: Detects protected attributes and bias signals using semantic embeddings.

**Key Features**:
- **Semantic Embeddings**: Uses Sentence Transformers (all-MiniLM-L6-v2) for efficient semantic similarity
- **Protected Attributes**: Gender, age, race/ethnicity, religion, disability, family status, sexual orientation
- **Bias Signals**: Gendered language, ageist language, ability bias, exclusionary language
- **Fairness Concerns**: Identifies exclusionary patterns in job descriptions
- **Risk Scoring**: Aggregates findings into 0.0-1.0 risk score
- **Recommendations**: Generates actionable improvement suggestions

**API**:
```python
bias_detector = BiasDetectionService()

# Single text scan
result = bias_detector.scan(text="job description...", context="job_description")
# Returns: {
#   "protected_attributes_found": ["age", "gender"],
#   "bias_signals_detected": ["gendered_language"],
#   "risk_score": 0.45,
#   "fairness_concerns": [...],
#   "recommendations": [...]
# }

# Dataset aggregation
metrics = bias_detector.aggregate_dataset_metrics(text_items=[...])
# Returns: {
#   "items_scanned": 100,
#   "items_with_protected_attributes": 35,
#   "items_with_bias_signals": 18,
#   "average_risk_score": 0.32,
#   "high_risk_items": 5
# }
```

**Fallback**: If sentence-transformers unavailable, uses keyword-based detection (less accurate but functional).

### 2. HallucinationEvaluationService

**Location**: `backend/app/governance/hallucination_evaluation_service.py`

**Purpose**: Evaluates whether generated text contains hallucinations or contradictions.

**Key Features**:
- **Semantic Faithfulness**: Sentence-level similarity comparison between source and generated text
- **Contradiction Detection**: Identifies logical contradictions ("always" vs "never")
- **Per-Claim Scoring**: Evaluates individual claims against source material
- **Consistency Checking**: Detects self-contradictions within a response
- **Semantic Alignment**: Measures overall semantic alignment 0.0-1.0

**API**:
```python
hallucination_eval = HallucinationEvaluationService()

# Evaluate hallucination risk
result = hallucination_eval.evaluate_hallucination_risk(
    source="original resume text...",
    generated="agent response..."
)
# Returns: {
#   "hallucination_risk": 0.25,
#   "is_faithful": True,
#   "faithfulness_score": 0.75,
#   "contradictions_detected": [],
#   "unsupported_claims": [],
#   "semantic_alignment": 0.82
# }

# Score individual claims
claims_result = hallucination_eval.calculate_faithfulness_score(
    claims=["Candidate has 10 years experience", "..."],
    source="resume text..."
)
# Returns: {
#   "claims_evaluated": 2,
#   "faithful_claims": 2,
#   "partially_faithful": 0,
#   "unsupported_claims": 0,
#   "average_faithfulness": 0.95
# }

# Check consistency
consistency = hallucination_eval.check_consistency(text="response...")
# Returns: {
#   "is_consistent": True,
#   "self_contradictions": [],
#   "consistency_score": 1.0
# }
```

**Fallback**: If sentence-transformers unavailable, uses simpler word-overlap and keyword-based detection.

### 3. ExplainabilityService

**Location**: `backend/app/governance/explainability_service.py`

**Purpose**: Provides transparency and traceability for AI decisions.

**Key Features**:
- **Decision Attribution**: Maps decision to contributing input factors
- **Semantic Attribution**: Uses embeddings to identify relevant inputs
- **Human-Readable Explanations**: Generates explanations for different audiences
- **Transparency Scoring**: Quantifies how explainable the decision is
- **Quality Checklist**: Ensures responses meet explainability standards

**API**:
```python
explainability = ExplainabilityService()

# Attribute decision
attribution = explainability.attribute_decision(
    decision_output="Candidate is ready for next stage",
    input_context={
        "resume": "5 years Python experience...",
        "job_description": "Requires senior Python developer..."
    },
    agent_name="InterviewCoachAgent"
)
# Returns: {
#   "agent": "InterviewCoachAgent",
#   "decision": "Candidate is ready for next stage",
#   "attributions": [
#       {"factor": "resume", "relevance": "semantic_similarity", "score": 0.85, ...},
#       {"factor": "job_description", "relevance": "semantic_similarity", "score": 0.72, ...}
#   ],
#   "key_factors": [...],
#   "transparency_score": 0.78
# }

# Generate explanation
explanation = explainability.generate_explanation(
    decision="...",
    attributions=[...],
    audience="user"  # or "reviewer" or "auditor"
)
# Returns: {
#   "summary": "This recommendation is based on analyzing: resume, job description.",
#   "key_factors": [...],
#   "reasoning": "...",
#   "confidence_note": "Strong evidence",
#   "limitations": [...]
# }

# Quality checklist
checklist = explainability.quality_checklist(agent_response={...})
# Returns: {
#   "has_reasoning": True,
#   "has_confidence_score": True,
#   "has_decision_trace": True,
#   "has_audit_metadata": True,
#   "is_human_readable": True,
#   "all_checks_pass": True
# }
```

### 4. SharpGovernanceService (Refactored)

**Location**: `backend/app/governance/sharp_governance_service.py`

**Purpose**: Orchestrates AI-based services plus traditional SHARP audit logic.

**Integration**:
```python
governance_service = SharpGovernanceService()

# Automatically uses: BiasDetectionService, HallucinationEvaluationService, ExplainabilityService
audited_response = governance_service.audit(
    response=agent_response,
    original_input="original job description or resume..."
)

# Now response.sharp_metadata contains:
# {
#   "governance": { ... },
#   "bias_check": { "risk_score": 0.3, "protected_attributes": [...], ... },
#   "hallucination_risk": { "risk": 0.15, "faithful": True, ... },
#   "explainability": { "transparency_score": 0.8, "attribution": {...}, ... },
#   ...
# }
```

## Integration Flow

### Orchestration Level

```python
# In orchestration_agent.py
class OrchestrationAgent:
    def __init__(self, agent_list, governance, fairness_service=None):
        self.governance = governance
        self.fairness_service = fairness_service  # Optional FairnessService

    def _run_agent(self, state):
        # Run agent
        response = agent.process(state.input, context)
        
        # Apply governance (now uses all AI services)
        audited = self.governance.audit(response, input_text)
        
        # Optional: Also apply generic fairness scan
        if self.fairness_service:
            fairness_metadata = self.fairness_service.scan(state.input, audited)
            audited.sharp_metadata["fairness"] = fairness_metadata
```

### Response Metadata Structure

```python
{
    "agent_name": "InterviewCoachAgent",
    "content": "Great answer! Here's feedback...",
    "confidence_score": 0.85,
    "sharp_metadata": {
        "governance": {
            "governance_audit": "flagged",  # "passed" or "flagged"
            "audit_timestamp": 1704067200000,
            "audit_flags": ["bias_review_required"],
            "hallucination_check_passed": True,
            "confidence_check_passed": True
        },
        "bias_check": {
            "response_bias": {
                "protected_attributes_found": [],
                "bias_signals_detected": ["gendered_language"],
                "risk_score": 0.35
            },
            "input_bias": {...},
            "risk_score": 0.35,
            "recommendations": ["Use gender-neutral language"]
        },
        "hallucination_risk": {
            "hallucination_risk": 0.18,
            "is_faithful": True,
            "faithfulness_score": 0.82,
            "semantic_alignment": 0.85
        },
        "explainability": {
            "transparency_score": 0.82,
            "attribution": {
                "key_factors": [
                    {"factor": "resume", "influence": 0.85, ...},
                    {"factor": "candidate_answer", "influence": 0.72, ...}
                ]
            },
            "explanation": {
                "summary": "Decision based on resume and answer quality",
                "reasoning": "  • resume: 0.85\n  • answer: 0.72",
                "confidence_note": "Strong evidence"
            }
        }
    }
}
```

## Configuration

Add to `backend/app/core/config.py`:

```python
class Settings(BaseSettings):
    # Governance thresholds
    GOVERNANCE_CONFIDENCE_THRESHOLD: float = 0.3
    GOVERNANCE_HALLUCINATION_RISK_THRESHOLD: float = 0.5
    GOVERNANCE_BIAS_RISK_THRESHOLD: float = 0.6
    
    # Semantic similarity thresholds
    SEMANTIC_RELEVANCE_THRESHOLD: float = 0.3
    SEMANTIC_PROTECTED_ATTRIBUTE_THRESHOLD: float = 0.5
    SEMANTIC_BIAS_SIGNAL_THRESHOLD: float = 0.6
    
    # Embedding model
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
```

## Testing

### Unit Tests
- `test_bias_detection.py`: BiasDetectionService semantic detection
- `test_hallucination_evaluation.py`: Faithfulness and contradiction detection
- `test_explainability.py`: Decision attribution and transparency
- `test_governance_orchestration.py`: Full pipeline integration

### Integration Tests
- Verify all services initialize correctly with/without transformers
- Test fallback behavior when embeddings unavailable
- Check Langfuse trace enrichment
- Validate governance flags and human review escalation

## Performance Considerations

### Latency
- BiasDetectionService: ~50-100ms per scan (embeddings computation)
- HallucinationEvaluationService: ~100-200ms (sentence-level comparison)
- ExplainabilityService: ~50-80ms (attribution analysis)
- **Total per response**: ~200-400ms (acceptable for async processing)

### Optimization Strategies
1. **Batch processing**: Pre-compute embeddings for common phrases
2. **Caching**: Store embeddings for job descriptions across multiple candidates
3. **Lazy initialization**: Load embeddings model only if semantic services needed
4. **Async tracing**: Do not block on Langfuse span updates

## Future Enhancements

1. **SHAP Integration**: Feature importance analysis from LLM predictions
2. **CFR (Counterfactual Fairness Review)**: Generate alternative wordings to test fairness
3. **Custom Embedding Models**: Fine-tune models on interview/hiring domain
4. **Caching Layer**: Redis caching for frequently-scanned texts
5. **Explainability Visualizations**: Dashboard showing decision factors
6. **Responsible AI Report Generation**: Automated audit reports for compliance

## References

- **Semantic Embeddings**: https://www.sbert.net/
- **IMDA AI Governance Framework**: https://www.imda.gov.sg
- **Explanation Methods**: https://lime-ml.readthedocs.io/
- **Fairness Metrics**: https://fairness.ai/
