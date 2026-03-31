# Interview Agent Security and Responsible AI

This implementation is aligned to the IMDA/PDPC Model AI Governance Framework pillars of internal governance, human involvement, operations management, and stakeholder communication, and to Singapore guidance that AI should be explainable, transparent, fair, and human-centric.

## Agent-specific security risks

- Prompt injection through candidate answers, resume content, or job descriptions.
- PII exposure in resumes, message history, or interview summaries.
- Biased or discriminatory coaching if the job description contains protected-attribute signals.
- Over-retention of sensitive interview content in downstream summaries and traces.

## Mitigations implemented

- Code level:
  - `BaseAgent` scans inputs for prompt-injection patterns and sanitizes outputs.
  - `InterviewCoachAgent` screens candidate-controlled text for adversarial or prompt-injection patterns before model execution and blocks suspicious replies with a deterministic re-ask.
  - `InterviewCoachAgent` redacts direct identifiers such as email, phone, and SSN before prompt construction.
  - `InterviewCoachAgent` keeps redacted interview answers for completion-summary generation.
  - `InterviewCoachAgent` emits structured explainability, bias, and governance metadata in `sharp_metadata`.
- Workflow level:
  - `SharpGovernanceService` audits interview responses and flags human review when sensitive-content or bias signals appear.
  - **NEW: AI-based bias detection** — `BiasDetectionService` uses semantic embeddings to detect protected attributes and bias signals in job descriptions, candidate inputs, and agent responses. Replaces hardcoded pattern matching.
  - **NEW: Semantic hallucination evaluation** — `HallucinationEvaluationService` uses semantic similarity (not just word overlap) to detect when generated responses made unsupported or contradictory claims.
  - **NEW: Decision explainability** — `ExplainabilityService` provides attribution analysis showing which input factors influenced each decision.
  - Governance also flags blocked prompt-injection attempts for audit and follow-up.
  - The deploy workflow runs targeted interview security and governance tests before image build and deployment.
  - Existing Trivy scans remain in the deployment workflow for repository and container-image risk visibility.

## Explainable and Responsible AI alignment

### Development

- The interview flow uses schema-constrained JSON to keep outputs predictable and inspectable.
- Decision traces and reasoning fields record why the agent scored or advanced a response.
- Deterministic fallback scoring reduces silent failure when the model omits progression metadata.
- Adversarial-input tests cover prompt-injection attempts, suspicious markup, sensitive-content redaction, and governance escalation.
- **NEW: AI-powered bias testing** — Tests now use semantic bias detection to verify fairness across diverse candidate backgrounds, job descriptions with varying language, and edge cases.
- **NEW: Hallucination regression tests** — Tests verify that responses remain faithful to source materials using semantic similarity evaluation.

### Deployment

- Every agent response is passed through governance auditing after orchestration.
- **NEW: Multi-service governance pipeline** — Responses flow through:
  1. **Bias Detection**: Scans for protected attributes and biased language using embeddings
  2. **Hallucination Evaluation**: Checks faithfulness using semantic similarity
  3. **Explainability Analysis**: Attributes decision to key factors
  4. **Traditional SHARP Audit**: Confidence thresholds, quantifiable claims, content validation
- CI now enforces interview-agent and governance tests before deployment proceeds.
- Langfuse-compatible tracing supports auditability and post-deployment monitoring.
- **NEW: Governance metadata enrichment** — Governance spans now include:
  - `bias_check`: Protected attributes detected, risk score, recommendations
  - `hallucination_risk`: Semantic faithfulness score, contradiction detection
  - `explainability`: Decision attribution factors and transparency score
- The deployment path preserves safety evidence because governance metadata is merged rather than overwritten.

## How the interview agent addresses explainability

- The response includes `feedback`, `answer_score`, `can_proceed`, and `next_challenge` so users can understand progression decisions.
- `decision_trace` records the question number, model path, and scoring basis.
- `reasoning` summarizes that coaching decisions are based on resume-job alignment and answer-quality heuristics.
- **NEW: AI-driven decision attribution** — `ExplainabilityService` now provides:
  - Attribution scores showing which input factors (resume, job description, candidate answer) influenced the decision
  - Transparency score indicating how explainable the decision is
  - Human-readable explanations tailored for different audiences (user, reviewer, auditor)
- Structured metadata also maps controls to IMDA governance domains so review teams can trace how development and deployment practices meet governance expectations.

## Bias mitigation

- The agent is instructed not to infer protected attributes or personalize coaching on that basis.
- **NEW: Semantic bias detection** — Potentially biased language in job descriptions and responses is detected using:
  - **Semantic embeddings**: Compares input text against protected attribute anchors and bias signal examples
  - **Fairness concerns evaluation**: Identifies exclusionary language, gendered language, ageist signals, and ability bias
  - **Risk scoring**: Aggregates findings into a 0.0–1.0 risk score
  - **Recommendations**: Generates specific suggestions for improvement (e.g., "Use gender-neutral language")
- **Dataset-level fairness metrics** — The `BiasDetectionService` can aggregate metrics across collections of job descriptions or interactions:
  - Items with protected attributes
  - Items with bias signals
  - High-risk items requiring human review
  - Frequency analysis of attribute mentions and bias patterns
- Coaching remains anchored to evidence in the resume, the job description, and the candidate answer.
- The interview agent is advisory only; it does not make autonomous hiring decisions, which reduces fairness and accountability risk.

## Hallucination and Faithfulness

- **NEW: Semantic hallucination detection** — Instead of just counting new words, the system now:
  - Encodes source and generated text into semantic embeddings
  - Compares sentence-level semantic alignment
  - Detects contradictions using logical patterns (e.g., "always" vs. "never")
  - Identifies unsupported claims that deviate from source material
  - Calculates faithfulness scores per claim
  - Checks for internal consistency (self-contradictions within response)
- **Hallucination risk assessment**:
  - Individual claim faithfulness (per-claim scoring)
  - Overall response faithfulness (aggregate score)
  - Contradiction detection between source and response
  - Example: If coach says "You must have X skill" but resume doesn't mention X, this is flagged as potentially unsupported

## Sensitive content and governance alignment

- Direct identifiers are redacted before prompts reach the model.
- Redacted answers are used for interview completion summaries.
- **NEW: Semantic sensitivity detection** — Protected attribute mentions are flagged based on semantic relevance, not just regex patterns.
- Sensitive-content and bias signals populate `sharp_metadata`, and governance can flag `requires_human_review`.
- Prompt-injection attempts are treated as security events and surfaced through governance metadata.

## IMDA Model AI Governance Framework alignment

### Internal governance structures and measures

- Agent-specific risks, mitigations, and Responsible AI metadata are attached to every interview response.
- **NEW: Multi-layer governance audit** — Each response now includes:
  - Bias detection results (protected attributes, risk score, recommendations)
  - Hallucination evaluation (faithfulness score, contradictions)
  - Decision attribution and explainability metrics
  - Traditional SHARP audit flags (confidence, quantifiable claims, content strength)
- CI now enforces targeted interview-agent security and governance tests before deployment.
- **NEW: Governance span tracking** — All governance checks are traced in Langfuse with results stored as structured metadata for audit trails.

### Human involvement in AI-augmented decision-making

- The interview agent provides coaching support only and does not take autonomous employment actions.
- **NEW: Transparency for reviewers** — When high-risk flags are raised (bias, hallucination, low confidence, etc.), the governance metadata includes:
  - Clear explanation of why the flag was raised
  - Severity and risk score
  - Actionable recommendations for review
  - Attribution factors if applicable
- Sensitive, biased, adversarial, or inconsistent cases trigger `human_review_recommended` and governance flags.

### Operations management

- Untrusted user text is screened for prompt injection before model calls.
- Inputs are redacted for direct identifiers before prompts are built.
- Post-response governance audits preserve and evaluate interview safety metadata.
- **NEW: Governance service composition** — Four specialized services handle different governance concerns:
  1. `BiasDetectionService`: Semantic fairness and protected attribute detection
  2. `HallucinationEvaluationService`: Semantic faithfulness and consistency checking
  3. `ExplainabilityService`: Decision attribution and transparency
  4. `SharpGovernanceService`: Orchestrates the above + traditional SHARP checks

### Stakeholder interaction and communication

- Users receive explainable fields such as `feedback`, `answer_score`, `can_proceed`, and `next_challenge`.
- **NEW: Transparent decision explanations** — Users and reviewers can access:
  - Summary of key factors that influenced the decision
  - Confidence level based on evidence strength
  - Specific limitations and caveats
  - Plain-language reasoning (not just scores)
- Reviewers receive decision traces, semantic attribution analysis, bias detection results, and structured governance metadata for auditability.
