# Agent Governance & Traceability

## Explainability & Traceability

### How does the solution ensure explainability and traceability of agent decisions?

**Implementation:**
- **Langfuse Integration**: Every agent decision is captured in Langfuse traces with complete context
  - `session_id`: Links all decisions within a user session
  - `metadata`: Includes agent name, decision rationale, input/output
  - `environment`: Distinguishes local/staging/production for audit trails
- **Agent Decision Logging**: Each agent records:
  - Input received
  - Processing steps
  - Scoring/ranking criteria used
  - Final decision with confidence level
  - Timestamp and version info
- **SHAP Governance Service**: Provides audit trails with:
  - Hallucination detection flags
  - Confidence threshold validation
  - Content strength validation
- **Trace Propagation**: `session_id` automatically propagated across all nested spans so every decision can be traced back to a user session

### Architecture:
```
User Request (session_id=abc)
    ↓ [Langfuse trace]
API Endpoint (/api/v1/chat)
    ↓ [trace.span with session_id propagated]
OrchestrationAgent
    ↓ [trace.span per agent]
ResumeCriticAgent → [decision logs, confidence, audit flags]
JobAlignmentAgent → [decision logs, confidence, audit flags]
InterviewCoachAgent → [decision logs, confidence, audit flags]
ContentStrengthAgent → [decision logs, confidence, audit flags]
    ↓ [all aggregated to single trace]
Response back to user [with decision trail in Langfuse]
```

---

## Safeguards: Bias, Fairness, Accountability, Trust, Assurance

### What safeguards are in place?

**1. Governance Audit Service** (`app/governance/sharp_governance_service.py`)
- **Hallucination Detection**: Now uses semantic similarity (embeddings) to detect unsupported claims, rather than just surface-level pattern matching
- **Confidence Thresholds**: Only accepts decisions above minimum confidence (default: 0.3)
- **Quantifiable Pattern Validation**: Ensures claims with numbers are supported
- **Content Strength Validation**: Agent-specific quality checks
- **AI-Powered Decision Flow**: Integrates three specialized AI services (see below)

**2. AI-Based Bias Detection** (`app/governance/bias_detection_service.py`) — NEW
- **Semantic Embeddings**: Uses sentence-transformers to detect protected attributes (gender, age, race, religion, disability, family status, sexual orientation) beyond simple keyword matching
- **Bias Signal Detection**: Identifies gendered language ("rockstar", "ninja"), ageist language, ability bias, and exclusionary language
- **Fairness Concern Evaluation**: Semantic analysis of job descriptions for potential exclusionary patterns
- **Risk Scoring**: Aggregates findings into 0.0-1.0 fairness risk scores
- **Dataset Metrics**: Can aggregate fairness metrics across collections of job descriptions
- **Recommendations**: Provides actionable suggestions for improving fairness

**3. Hallucination Evaluation** (`app/governance/hallucination_evaluation_service.py`) — NEW
- **Semantic Faithfulness**: Compares source and generated text at sentence level using embeddings
- **Contradiction Detection**: Identifies logical contradictions (e.g., "always" vs "never")
- **Claim-Level Scoring**: Per-claim faithfulness evaluation
- **Self-Consistency Checks**: Detects internal contradictions within a single response
- **Semantic Alignment Metrics**: Measures how well generated text aligns with source material

**4. Explainability Service** (`app/governance/explainability_service.py`) — NEW
- **Decision Attribution**: Shows which input factors influenced each decision using semantic similarity attribution
- **Transparency Scoring**: Quantifies how explainable a decision is
- **Human-Readable Explanations**: Generates explanations tailored for different audiences (user, reviewer, auditor)
- **Quality Checklist**: Ensures responses meet explainability standards (reasoning, confidence, trace, metadata)

**5. Fairness Service** (`app/governance/fairness_service.py`)
- Protected attribute and bias pattern detection
- NLI consistency checking
- Dataset-level bias aggregation

**6. Bias Mitigation**
- **AI-Based Detection**: `BiasDetectionService` scans all text for protected attributes and bias signals
- **SHAP Analysis** (future): Feature importance analysis available for model decisions
- **Prompt Versioning**: All prompts tracked in Langfuse so drift is detectable
- **Multi-Agent Consensus**: Different agents evaluate same input; disagreements flagged

**7. Accountability**
- **Session Tracking**: Every decision linked to `session_id` for traceability
- **Audit Timestamps**: Every decision timestamped for accountability
- **Error Logging**: Failures recorded with full context
- **Environment Tagging**: `production` vs `staging` clearly marked
- **Governance Span Enrichment**: All governance checks stored in Langfuse traces with rich metadata

**8. Trust**
- **Confidence Scoring**: Responses include confidence levels
- **Decision Attribution**: `ExplainabilityService` identifies which factors influenced each decision
- **Reasoning Capture**: Agent reasoning steps recorded in spans
- **Metadata Transparency**: All input/output stored in Langfuse for verification
- **Versioning**: `APP_VERSION` and `environment` tracked per trace
- **AI Service Confidence**: Each governance service returns confidence/risk scores

**9. Assurance**
- **Pre-Deployment Tests**: Golden set E2E tests with known good/bad cases
- **Production Monitoring**: Real-time Langfuse dashboards for anomaly detection
- **Automated Guardrails**: Multi-service governance pipeline blocks problematic responses
- **Semantic Regression Testing**: Tests verify fairness, hallucination risk, and explainability across edge cases

---

## Common Services (Shared Memory, Logs)

### What reusable infrastructure is required?

**1. Langfuse (Observability & Tracing)**
- Central service for all trace data
- Enables cross-agent decision correlation
- Provides session-level aggregation
- Supports prompt versioning and experiment tracking

**2. Session Storage** (`app/api/v1/session_store.py`)
- Shared session context across agents
- Maintains user-specific state (resume, JD, preferences)
- Propagates `session_id` to all agents

**3. Logging Service** (`app/core/logging.py`)
- Centralized structured logging
- Compatible with Langfuse metadata
- Enables log-level filtering by environment

**4. Firebase/Auth** (`app/core/auth.py`)
- User identity tracking
- Session ownership validation
- Access control for accountability

**5. Configuration Management** (`app/core/config.py`)
- Centralized settings (Langfuse keys, model versions, thresholds)
- Environment-aware configuration (local/staging/production)
- Feature flags for A/B testing governance rules

---

## Reusable Libraries & Frameworks

### What frameworks power the agent orchestration?

**1. LangGraph** (`app/orchestration/orchestration_agent.py`)
- **Purpose**: Stateful agent orchestration and workflow management
- **Usage**: Coordinates multi-agent workflow with state persistence
- **Tracing**: Integrated with `langfuse.trace()` at orchestration level
- **Benefit**: Checkpoint-based recovery and deterministic re-runs

**2. LangChain** (if used)
- **Purpose**: LLM chains and tools
- **Integration**: Agents built on LangChain utilities
- **Tracing**: Compatible with Langfuse via SDK integration

**3. Sentence Transformers** (sentence-transformers)
- **Purpose**: Semantic embeddings for AI-based governance decisions
- **Usage**: Bias detection, hallucination evaluation, decision attribution
- **Model**: all-MiniLM-L6-v2 (fast, lightweight, suitable for governance)

**4. Pydantic v2** (`app/models/`)
- **Purpose**: Schema validation and serialization
- **Usage**: Type-safe agent requests/responses
- **Tracing**: Automatic metadata extraction from models

**5. FastAPI** (`app/api/`)
- **Purpose**: HTTP API layer
- **Tracing**: Wrapped endpoints with `langfuse.propagate_attributes(session_id=...)`
- **Benefit**: Clean async/await support for agent calls

**6. Custom Governance Services** — NEW
- **BiasDetectionService**: Semantic bias and protected attribute detection
- **HallucinationEvaluationService**: Semantic faithfulness evaluation
- **ExplainabilityService**: Decision attribution and transparency
- **FairnessService**: Protected attribute and bias pattern detection
- **SharpGovernanceService**: Orchestrates above services plus traditional checks

**7. Custom Utilities**
- **NLI Service** (`app/utils/`): Natural Language Inference for consistency checking
- **PDF Parser** (`app/utils/pdf_parser.py`): Resume extraction
- **JSON Parser** (`app/utils/json_parser.py`): Response parsing

---

## Integration with Langfuse

Each layer adds governance metadata to traces:

```python
# API Layer - establishes session context
with langfuse.propagate_attributes(session_id="user-abc"):
    with langfuse.trace(name="chat_api_request", metadata={
        "user_id": get_current_user,
        "endpoint": "/api/v1/chat",
    }) as trace:
        
        # Orchestration Layer - coordinates agents
        with langfuse.trace(name="orchestration", metadata={
            "strategy": "multi-agent-consensus",
        }) as orch_trace:
            
            # Agent Layer - records individual decisions
            with langfuse.trace(name="ResumeCriticAgent_process", metadata={
                "agent": "ResumeCriticAgent",
                "input_length": len(input),
            }) as agent_trace:
                response = agent.process(input, context)
                agent_trace.update(output={
                    "confidence": response.confidence,
                    "audit": governance_check,
                })
```

**Result**: Complete decision trail in Langfuse, filterable by:
- `session_id` (trace back user session)
- `environment` (production vs staging)
- `agent` (which agent made the decision)
- `confidence` (decision quality)
- `audit` flags (bias/hallucination markers)

---

## Deployment Assurance

| Layer | Checklist |
|-------|-----------|
| **Local** | `APP_ENV=local` in `.env`, Langfuse optional |
| **Staging** | `APP_ENV=staging` on `langfuse` branch, Langfuse required |
| **Production** | Would be `APP_ENV=production` (separate workflow) |

**Monitoring**: Use Langfuse dashboards to:
- Filter traces by environment
- Monitor confidence trends
- Alert on audit failures
- Compare agent performance across versions
