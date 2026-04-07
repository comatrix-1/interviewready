# Logical Architecture Diagram — InterviewReady

This document presents the complete logical architecture of the InterviewReady multi-agent AI system and provides detailed justification for every layer, component, and design decision. The diagram is drawn from the actual codebase structure and reflects the deployed system on the `sit` / `main` branch.

---

## Table of Contents

1. [Layered Logical Architecture Diagram](#1-layered-logical-architecture-diagram)
2. [Component Interaction Diagram](#2-component-interaction-diagram)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
   - 3.1 [Resume Analysis (REST)](#31-resume-analysis-rest)
   - 3.2 [Voice Interview (WebSocket)](#32-voice-interview-websocket)
   - 3.3 [LLM-as-a-Judge Evaluation](#33-llm-as-a-judge-evaluation)
4. [Session State Schema](#4-session-state-schema)
5. [Layer-by-Layer Justification](#5-layer-by-layer-justification)
6. [Cross-Cutting Concerns](#6-cross-cutting-concerns)
7. [Key Design Decisions](#7-key-design-decisions)

---

## 1. Layered Logical Architecture Diagram

```
╔══════════════════════════════════════════════════════════════════════════╗
║                        INTERVIEWREADY SYSTEM                             ║
║                    Multi-Agent AI Platform                               ║
╚══════════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — PRESENTATION                                                  │
│                                                                          │
│  React 18 + TypeScript · Tailwind CSS · Vite 5                          │
│                                                                          │
│  ┌─────────────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Workflow Steps UI   │  │  HITL Review │  │  Voice Interview UI  │   │
│  │  (5-step analysis)   │  │  Approval    │  │  (audio capture)     │   │
│  └─────────────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  backendService.ts  ·  Session Management  ·  Error Retry Logic   │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │  HTTPS REST (JSON)
                                    │  WSS WebSocket (audio)
┌───────────────────────────────────▼──────────────────────────────────────┐
│  LAYER 2 — API                                                           │
│                                                                          │
│  FastAPI · Pydantic v2 · CORS · slowapi (rate limiter 20 req/min)       │
│                                                                          │
│  ┌──────────────────┐  ┌───────────────────┐  ┌──────────────────────┐ │
│  │ POST /api/v1/chat│  │ GET /api/v1/agents│  │ GET /api/v1/sessions │ │
│  │ (agent dispatch) │  │ (agent registry)  │  │ (session management) │ │
│  └──────────────────┘  └───────────────────┘  └──────────────────────┘ │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │  GET /api/v1/interview/token     │  │  WS /api/v1/interview/live  │ │
│  │  (GeminiLive session config)     │  │  (real-time voice relay)    │ │
│  └──────────────────────────────────┘  └──────────────────────────────┘ │
│                                                                          │
│  Schema validation → Session binding → Request size enforcement          │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│  LAYER 3 — ORCHESTRATION                                                 │
│                                                                          │
│  LangGraph StateGraph · OrchestrationAgent                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  1. Parse Intent (RESUME_CRITIC | CONTENT_STRENGTH | ALIGNMENT  │    │
│  │                  | INTERVIEW_COACH)                              │    │
│  │  2. Normalise Resume  (resumeData JSON   OR                     │    │
│  │                        resumeFile PDF → ExtractorAgent)          │    │
│  │  3. Select Agent Sequence  (INTENT_TO_AGENTS map)               │    │
│  │  4. Run LangGraph _run_agent loop                               │    │
│  │  5. Propagate SessionContext across all agents                   │    │
│  │  6. Collect decision_trace + shared_memory                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└───────┬──────────────┬──────────────┬──────────────┬────────────────────┘
        │              │              │              │
┌───────▼──┐  ┌────────▼──┐  ┌───────▼──────┐  ┌───▼────────────────┐
│ LAYER 4a │  │ LAYER 4b  │  │  LAYER 4c    │  │  LAYER 4d          │
│ Extractor│  │ Resume    │  │  Content     │  │  Interview         │
│  Agent   │  │  Critic   │  │  Strength    │  │  Coach             │
│          │  │  Agent    │  │  Agent       │  │  Agent             │
│ PDF→JSON │  │ ATS audit │  │ Skills eval  │  │ Multi-turn Q&A     │
│ Confidence  │ Issue list│  │ Evidence     │  │ Stateful (5 Qs)    │
│ scoring  │  │ + scoring │  │ strength     │  │ Bias/inject check  │
└───────┬──┘  └────────┬──┘  └───────┬──────┘  └───┬────────────────┘
        └──────────────┴──────────────┴──────────────┘
                                 │
                    All agents extend BaseAgent:
                    LLMGuardScanner.scan_input()  ← injected here
                    GeminiService.generate()      ← LLM call
                    LLMGuardScanner.scan_output() ← flagged here
                    OutputSanitizer.sanitize()    ← PII strip here
                                 │
┌────────────────────────────────▼─────────────────────────────────────────┐
│  LAYER 5 — AI MODEL                                                      │
│                                                                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │  GeminiService               │  │  GeminiLiveService               │ │
│  │  (google-generativeai)       │  │  (real-time voice interview)     │ │
│  │  gemini-2.5-flash (text)     │  │  gemini-3.1-flash-live-preview   │ │
│  │  temperature=0.0 (judge)     │  │  audio_input_queue               │ │
│  └──────────────────────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │  MockGeminiService  (per-agent mock flags via .env / config.py)     ││
│  │  MOCK_RESUME_CRITIC_AGENT=true  ·  MOCK_INTERVIEW_COACH_AGENT=true  ││
│  └──────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│  LAYER 6 — GOVERNANCE & SECURITY                                         │
│                                                                          │
│  Applied to every agent response via OrchestrationAgent._run_agent()    │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  SharpGovernanceService.audit()                                   │  │
│  │    ├─ hallucination_risk_assessment()  → metadata.hallucination.. │  │
│  │    ├─ _check_confidence_threshold()   → flags low_confidence      │  │
│  │    ├─ _validate_content_strength_agent() (ContentStrength only)   │  │
│  │    └─ audit_flags: ["hallucination_risk", "low_confidence"]       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  LLMGuardScanner  (security/llm_guard_scanner.py)                 │  │
│  │    ├─ scan_input()  → PromptInjection scanner                     │  │
│  │    └─ scan_output() → NoRefusal + Sensitive scanners              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  OutputSanitizer  (utils/output_sanitizer.py)                     │  │
│  │    └─ sanitize()  → strips PII (email, phone, SSN)                │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  InterviewCoachAgent-specific checks  (inline in interview_coach) │  │
│  │    ├─ PROMPT_INJECTION_PATTERNS regex                             │  │
│  │    ├─ BIAS_PATTERNS regex (age, gender, nationality)              │  │
│  │    ├─ SENSITIVE_PATTERNS (SSN, email, phone redaction)            │  │
│  │    └─ ANTI_JAILBREAK_DIRECTIVE (injected into system prompt)      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│  LAYER 7 — LLM-AS-A-JUDGE EVALUATION                                    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  LLmasJudgeEvaluator  (evals/llm_judge.py)                       │   │
│  │    ├─ build_judge_prompt(agent_name, input, output, expected)     │   │
│  │    ├─ GeminiService call at temperature=0.0  (deterministic)     │   │
│  │    ├─ Parse JudgeEvaluation {quality, accuracy, helpfulness}      │   │
│  │    └─ langfuse.score()  →  attach scores to parent trace          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  eval_rubrics.py  ·  evals/datasets/  ·  eval-runner.yml (GH Actions)   │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│  LAYER 8 — OBSERVABILITY & PERSISTENCE                                   │
│                                                                          │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐ │
│  │  Langfuse (cloud.langfuse.com)   │  │  In-memory SessionStore      │ │
│  │  - Distributed tracing           │  │  (app/orchestration/         │ │
│  │  - Cost & token tracking         │  │   persistence.py)            │ │
│  │  - Prompt versioning             │  │  - SessionContext per ID     │ │
│  │  - LLM judge score ingestion     │  │  - shared_memory             │ │
│  │  - Session-level aggregation     │  │  - conversation_history      │ │
│  └──────────────────────────────────┘  └──────────────────────────────┘ │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Structured JSON Logging  (app/core/logging.py, stdout)          │   │
│  │  Fields: session_id · agent_name · intent · latency · error      │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Interaction Diagram

The diagram below shows how components **call** each other during a typical resume analysis request, emphasising the separation between layers and the sequential application of governance controls.

```
Browser
  │
  │ POST /api/v1/chat  (intent=RESUME_CRITIC, resumeData, jobDescription)
  ▼
┌─────────────────────────────────────────────────────────────────────┐
│  chat.py  (FastAPI endpoint)                                        │
│  ├─ slowapi rate_limit()             ← rejects if > 20 req/min      │
│  ├─ Pydantic ChatRequest.validate()  ← rejects malformed schema     │
│  ├─ get_or_create_session_context()  ← binds SessionContext         │
│  └─ orchestrator.orchestrate()  ────────────────────────┐           │
└───────────────────────────────────────────────────────────│──────────┘
                                                           │
┌──────────────────────────────────────────────────────────▼──────────┐
│  OrchestrationAgent.orchestrate()                                   │
│  ├─ _parse_intent(request.intent)   → Intent.RESUME_CRITIC          │
│  ├─ _normalize_or_fail()            → Resume (Pydantic model)       │
│  │   └─ if resumeFile → ExtractorAgent.process()                    │
│  ├─ INTENT_TO_AGENTS[intent]        → ["ResumeCriticAgent"]         │
│  └─ workflow.invoke(OrchestrationState)  ────────────────┐          │
└──────────────────────────────────────────────────────────│──────────┘
                                                           │
┌──────────────────────────────────────────────────────────▼──────────┐
│  LangGraph StateGraph  (_run_agent node)                            │
│  ├─ [Pre-call]  LLMGuardScanner.scan_input()                        │
│  │               └─ PromptInjection scanner → block if unsafe       │
│  ├─ agent.process(AgentInput, SessionContext)                       │
│  │   └─ BaseAgent.process()                                         │
│  │       ├─ check_mock_mode() → MockGeminiService (if enabled)      │
│  │       ├─ GeminiService.generate_response(prompt, history)        │
│  │       ├─ parse_json_payload(raw_response)                        │
│  │       └─ return AgentResponse(content, reasoning, confidence)    │
│  ├─ [Post-call] LLMGuardScanner.scan_output()                       │
│  │               └─ NoRefusal + Sensitive scanners                  │
│  ├─ OutputSanitizer.sanitize(response)                              │
│  └─ SharpGovernanceService.audit(response, original_input)          │
│       ├─ hallucination_risk_assessment()                             │
│       ├─ _check_confidence_threshold()                              │
│       └─ attach sharp_metadata to AgentResponse                     │
└──────────────────────────────────────────────────────────┬──────────┘
                                                           │
                    AgentResponse {
                      agent_name, content, reasoning,
                      confidence_score, needs_review,
                      low_confidence_fields,
                      decision_trace, sharp_metadata
                    }
                                                           │
┌──────────────────────────────────────────────────────────▼──────────┐
│  chat.py  → ChatApiResponse { agent, payload }                      │
│  ├─ Langfuse span updated with output metadata                      │
│  └─ JSON response to browser                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Flow Diagrams

### 3.1 Resume Analysis (REST)

```
User (browser)
  │  POST /api/v1/chat?sessionId=<uuid>
  │  { "intent": "RESUME_CRITIC",
  │    "resumeData": { work:[...], skills:[...] },
  │    "jobDescription": "Senior SWE at Acme..." }
  ▼
API Layer
  ├─ Rate limit: 20 req/min (reject 429 if exceeded)
  ├─ Schema validation (Pydantic v2 ChatRequest)
  ├─ Session bind: SessionContext.session_id = <uuid>
  └─ Call orchestrator
        ▼
Orchestration Layer
  ├─ Intent → RESUME_CRITIC → agent_sequence = ["ResumeCriticAgent"]
  ├─ Resume normalise: resumeData already JSON → Resume model
  └─ LangGraph StateGraph.invoke()
        ▼
Agent Layer  (ResumeCriticAgent)
  ├─ LLMGuardScanner.scan_input(resume + JD text)
  │   └─ PromptInjection scanner → safe ✓
  ├─ Construct system prompt + user context
  ├─ GeminiService.generate_response()  → gemini-2.5-flash
  │   └─ Returns ResumeCriticReport JSON
  ├─ parse_json_payload()
  ├─ LLMGuardScanner.scan_output()      → safe ✓
  └─ OutputSanitizer.sanitize()         → no PII found
        ▼
Governance Layer
  ├─ SharpGovernanceService.audit()
  │   ├─ hallucination_risk_assessment() → passed ✓
  │   ├─ _check_confidence_threshold(0.85 ≥ 0.3) → passed ✓
  │   └─ sharp_metadata.governance_audit = "passed"
  └─ decision_trace += ["ResumeCriticAgent: audited", "SHARP: passed"]
        ▼
Response
  { agent: "ResumeCriticAgent",
    payload: { issues:[...], summary:"...", score:72 },
    confidence_score: 0.85,
    needs_review: false,
    decision_trace: [...],
    sharp_metadata: { governance_audit:"passed", ... } }
        ▼
Browser renders: issue list, score badge, decision trace accordion
```

### 3.2 Voice Interview (WebSocket)

```
User (browser) — clicks "Start Voice Interview"
  │
  │  GET /api/v1/interview/token?sessionId=<uuid>
  ▼
FastAPI
  ├─ Retrieve SessionContext (resume_data + job_description)
  └─ Return { api_key, model:"gemini-3.1-flash-live-preview",
              system_instruction: "<resume + JD context>" }
  │
  │  WSS /api/v1/interview/live?sessionId=<uuid>
  ▼
GeminiLive.start_session()
  ├─ audio_input_queue  ←─── browser microphone audio chunks
  ├─ GeminiLiveService.connect(model, system_instruction)
  │   └─ Gemini Live API (bidirectional WSS)
  │         ↑ sends real-time AI interviewer audio
  └─ audio_output_callback ───► browser speaker playback
```

### 3.3 LLM-as-a-Judge Evaluation

```
eval-runner.yml (GitHub Actions manual dispatch)
  │  inputs: agent, dataset, max_cases
  ▼
evals/run_evals.py
  ├─ Load EvalCase[] from evals/datasets/<agent>.json
  │
  └─ For each EvalCase:
      ├─ agent.process(input_data, SessionContext)  ← real Gemini call
      │   └─ AgentResponse.content
      │
      ├─ LLmasJudgeEvaluator.evaluate()
      │   ├─ build_judge_prompt(agent_name, input, output, expected)
      │   ├─ GeminiService(temperature=0.0).generate()
      │   └─ Parse JudgeEvaluation {
      │         quality_score:    0.0–1.0,
      │         accuracy_score:   0.0–1.0,
      │         helpfulness_score: 0.0–1.0
      │       }
      │
      └─ langfuse.score(trace_id, name="quality", value=0.82)
              │
              ▼
         Langfuse dashboard → trend charts, regression alerts
```

---

## 4. Session State Schema

The `SessionContext` object is the shared memory that travels through every layer in the system. Its schema determines what information each agent can access and what it contributes.

```
SessionContext
├── session_id: str           # UUID bound at API layer; key for SessionStore
├── user_id: Optional[str]    # "dev-user" in current deployment
├── resume_data: Optional[str | dict]
│     # Set by ExtractorAgent (PDF path) or from ChatRequest.resumeData
│     # All downstream agents read from here — no duplicate extraction
├── job_description: Optional[str]
│     # Set from ChatRequest.jobDescription; shared across all agents
├── shared_memory: Dict[str, Any]
│     # Accumulates results across agents within a session
│     # e.g., { "resume_critic_score": 72, "alignment_fit_score": 0.68 }
├── decision_trace: List[str]
│     # Append-only audit breadcrumb
│     # e.g., ["Orchestrator: intent=RESUME_CRITIC",
│     #        "ResumeCriticAgent: processed 5 sections",
│     #        "SHARP: governance_audit=passed"]
└── conversation_history: List[AgentResponse]
      # Full history for InterviewCoachAgent multi-turn reasoning
```

### AgentResponse Schema

```
AgentResponse
├── agent_name: Optional[str]      # "ResumeCriticAgent"
├── content: Optional[str]         # JSON-serialised structured result
├── reasoning: Optional[str]       # Human-readable explanation (explainability)
├── confidence_score: Optional[float]  # 0.0–1.0; < 0.3 → needs_review=true
├── needs_review: Optional[bool]   # HITL escalation flag
├── low_confidence_fields: List[str]   # Specific fields below threshold
├── decision_trace: List[str]      # Propagated from SessionContext
└── sharp_metadata: Dict[str, Any]
      # { governance_audit: "passed"|"flagged",
      #   audit_timestamp: <ms>,
      #   hallucination_check_passed: bool,
      #   confidence_check_passed: bool,
      #   audit_flags: ["hallucination_risk", "low_confidence"] }
```

---

## 5. Layer-by-Layer Justification

### Layer 1 — Presentation (React 18 + TypeScript + Tailwind)

| Decision | Justification |
|----------|---------------|
| **React 18 + TypeScript** | Concurrent rendering enables non-blocking UI updates while agent responses stream in. TypeScript enforces compile-time correctness of API contract types (`ChatApiResponse`, `AgentResponse`), reducing integration bugs. |
| **Vite 5 build tool** | HMR (Hot Module Replacement) reduces development cycle from minutes to sub-second. Tree-shaking and code splitting produce an optimised production bundle served by Nginx. |
| **Tailwind CSS** | Utility-first approach eliminates CSS specificity conflicts and enforces consistent spacing/colours without a component library dependency. Dark-mode support via `tailwind.config.ts`. |
| **HITL Approval UI** | Human-In-The-Loop approval for low-confidence extractions (`needs_review=true`) is surfaced as a front-end gate, ensuring no agent output is automatically trusted without user acknowledgement when confidence is below threshold. |
| **Voice interview UI** | Browser microphone capture + WebSocket relay enables real-time voice mock interviews without a separate mobile app, maximising reach while keeping architecture simple. |
| **backendService.ts abstraction** | All API calls centralised in one module; retry logic with exponential backoff and mock fallback protect against transient backend failures without coupling UI components to network logic. |

### Layer 2 — API (FastAPI + Pydantic v2 + slowapi)

| Decision | Justification |
|----------|---------------|
| **FastAPI** | Async-first design (asyncio) handles concurrent WebSocket connections and agent calls without thread-pool bottlenecks. Automatic OpenAPI generation from Pydantic models reduces documentation drift. |
| **Pydantic v2 schema validation** | `ChatRequest`, `ResumeFile`, `InterviewMessage` schemas reject malformed inputs at the boundary, before they reach agent logic. `field_validator` on `audioData` performs PCM→WAV conversion at entry point, normalising audio format before GeminiLive relay. |
| **slowapi rate limiter** | `DEFAULT_RATE_LIMIT` (20 req/min per IP) prevents DoS attacks and Gemini API quota exhaustion without requiring external infrastructure (API Gateway, WAF). |
| **`/api/v1/interview/token` endpoint** | Returns Gemini API key and model config to the browser so GeminiLive can be initialised client-side. Avoids embedding secrets in frontend bundle while enabling the WebSocket relay pattern. |
| **`/api/v1/agents` registry** | Exposes live system prompts so the frontend can display which agent is active and enable prompt inspection — supporting the explainability requirement. |
| **CORS middleware** | Explicit origin allowlisting prevents cross-origin request forgery while enabling the React SPA (different port/domain) to call the FastAPI backend. |

### Layer 3 — Orchestration (LangGraph StateGraph)

| Decision | Justification |
|----------|---------------|
| **LangGraph StateGraph** | Declarative state machine provides checkpointing, conditional edge routing (`continue` / `end`), and auditability. Simple function chains cannot recover from partial failures or support future parallel agent execution. |
| **OrchestrationAgent class** | Encapsulates intent routing, resume normalisation, and context propagation in one place. Agents never know about routing logic — they receive a normalised `AgentInput` and return `AgentResponse`. |
| **INTENT_TO_AGENTS map** | Clean separation between routing policy and agent implementation. Adding a new intent requires only a map entry, not changes to agent code. |
| **ExtractorAgent integration at normalisation** | PDF-to-JSON extraction is a prerequisite for all other agents. Running it at normalisation ensures downstream agents always receive a structured `Resume` model regardless of input format. |
| **Session context propagation** | `SessionContext.shared_memory` accumulates results across agents within a session, allowing InterviewCoachAgent to reference ResumeCriticAgent findings without re-invoking the critic. |
| **Langfuse `@observe` decoration** | `orchestrate()` and child spans are automatically traced; `propagate_attributes(session_id)` links all nested spans to the same session in Langfuse dashboard. |

### Layer 4 — Agent Layer (5 Specialised Agents)

| Agent | Design Justification |
|-------|---------------------|
| **ExtractorAgent** | Separates PDF parsing from analysis logic. Returns `Resume + _confidence` schema so downstream agents receive structured data with quality indicators. HITL gate (`needs_review`) prevents low-quality extractions from silently corrupting downstream analysis. |
| **ResumeCriticAgent** | Single-responsibility: ATS structural analysis only. `ResumeCriticReport.issues[]` with `{location, type, severity, description}` provides actionable, structured output rather than freeform prose, enabling frontend to render issue lists and severity badges. |
| **ContentStrengthAgent** | Evaluates evidence quality with `{location, original, suggested, evidenceStrength, type}` schema. JSON-path references back to the original resume enable precise, verifiable suggestions rather than generic advice. Faithfulness-first design prevents hallucinated suggestions. |
| **JobAlignmentAgent** | Semantic matching using JSON-path references into the resume for `skillsMatch` and `experienceMatch` makes alignment evidence traceable to source document sections. `missingSkills[]` with criticality enables candidates to prioritise upskilling. |
| **InterviewCoachAgent (Stateful)** | The only stateful agent: maintains `current_question_number`, `answer_score`, `can_proceed` gate, and full conversation history across turns. Two-phase design (evaluator sub-prompt → coach sub-prompt) separates scoring logic from question generation, improving rubric consistency. Bias/injection/PII checks are agent-local because interview answers carry the highest risk of adversarial content. |
| **BaseAgent mixin** | Consolidates LLM Guard scanning, output sanitization, mock mode, Langfuse tracing, and error handling in one place. All 5 agents inherit this without code duplication; security controls cannot be bypassed by individual agents. |

### Layer 5 — AI Model (GeminiService / GeminiLiveService / Mock)

| Decision | Justification |
|----------|---------------|
| **gemini-2.5-flash (text)** | Meets < 5 s latency requirement for analysis agents. Flash tier balances cost and quality for structured JSON output with function calling. |
| **gemini-3.1-flash-live-preview (voice)** | Ultra-low-latency bidirectional audio eliminates the need for a separate STT→NLU→TTS pipeline. Single API handles audio modality, reducing operational complexity. |
| **MockGeminiService per-agent** | Controlled per-agent via `MOCK_*_AGENT` env flags. CI/CD pipelines run all 42 tests without consuming Gemini API quota. Developers can enable/disable mocks selectively for debugging specific agents. |
| **GeminiService singleton** | Shared across all agents via dependency injection (`get_orchestration_agent()` factory). Single client instance manages authentication, retry logic, and model configuration in one place. |

### Layer 6 — Governance & Security

| Component | Justification |
|-----------|---------------|
| **SharpGovernanceService (post-agent audit)** | Applied uniformly to every agent response after the LangGraph loop, not inside individual agents. This ensures governance cannot be bypassed by agent code and enforces consistent thresholds (CONFIDENCE_THRESHOLD=0.3, HALLUCINATION_RISK_THRESHOLD=0.7) across all agents. |
| **LLMGuardScanner (pre + post call)** | Input scan blocks prompt injection before any LLM call is made — malicious content never reaches the model. Output scan detects refusals and sensitive content in model responses, preventing information leakage. In-process library; no external network call required. |
| **OutputSanitizer** | PII strip (email, phone, SSN) applied after LLM response and after LLM Guard, providing defence-in-depth. Even if LLM Guard misses a PII leak, sanitizer catches it before the response is returned. |
| **InterviewCoachAgent-local checks** | Interview answers carry the highest adversarial risk (candidates control the content). Inline `PROMPT_INJECTION_PATTERNS`, `BIAS_PATTERNS`, `SENSITIVE_PATTERNS` regex and `ANTI_JAILBREAK_DIRECTIVE` in system prompt provide agent-specific hardening beyond the shared BaseAgent controls. |
| **`sharp_metadata` merge (not overwrite)** | Governance metadata is merged into `AgentResponse.sharp_metadata` using dict update, preserving any pre-existing agent-level metadata. This ensures governance evidence is never silently dropped. |

### Layer 7 — LLM-as-a-Judge Evaluation

| Decision | Justification |
|----------|---------------|
| **Separate judge LLM call** | Evaluating with the same model that generated the response creates a self-referential bias. A dedicated judge prompt at `temperature=0.0` provides deterministic, independent scoring. |
| **Three-dimensional scoring (quality, accuracy, helpfulness)** | Single-score evaluation cannot distinguish between a response that is accurate but unhelpful versus one that is helpful but inaccurate. Three dimensions allow regression analysis on specific quality axes. |
| **Langfuse score API integration** | Attaching judge scores to parent Langfuse traces enables correlation between governance flags (Layer 6) and quality scores, revealing whether low-confidence responses also score poorly on accuracy. |
| **`eval-runner.yml` as manual-dispatch workflow** | Evaluation is a cost-incurring operation (real Gemini calls). Manual dispatch prevents accidental evaluation runs on every commit while still enabling on-demand quality gates before major releases. |

### Layer 8 — Observability & Persistence

| Component | Justification |
|-----------|---------------|
| **Langfuse** | Purpose-built for LLM workloads: tracks token costs, prompt versions, and latency per agent. Session-level aggregation aligns with HITL audit requirements. Native score API closes the quality feedback loop. |
| **In-memory SessionStore** | Cloud Run instances are stateless containers; sessions are held in memory for the lifetime of the container. This is sufficient for the demo scale (50–200 concurrent sessions). For production persistence, the `persistence.py` abstraction can be swapped to a Redis/database backend without changing agent code. |
| **Structured JSON logging (stdout)** | Machine-readable logs with `session_id`, `agent_name`, `intent`, `latency`, `error` fields are collected by Cloud Run and forwarded to Cloud Logging, enabling log-based alerting and audit queries without a dedicated log aggregation service. |

---

## 6. Cross-Cutting Concerns

These concerns span multiple layers and are enforced consistently across the system:

```
┌─────────────────────────────────────────────────────────────┐
│  CROSS-CUTTING CONCERNS                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Rate Limiting (Layer 2)                                   │
│    └─ slowapi 20 req/min prevents quota exhaustion & DoS   │
│                                                             │
│  Session State (Layers 3–4–8)                              │
│    └─ SessionContext travels from API → Orchestration       │
│       → Agent → persisted in SessionStore                  │
│                                                             │
│  Mock Mode (Layer 5)                                        │
│    └─ Per-agent env flags; CI uses mock for all agents     │
│       to run 42 tests without Gemini API quota             │
│                                                             │
│  Langfuse Tracing (Layers 3–6–7–8)                         │
│    └─ @observe decorators on orchestrate(), agent.process()│
│       propagate_attributes(session_id) links all spans     │
│                                                             │
│  Decision Trace (Layers 3–4–6)                             │
│    └─ Append-only list in SessionContext; each layer       │
│       appends its step for user-visible audit trail        │
│                                                             │
│  HTTPS / WSS Encryption (Layers 1–2)                       │
│    └─ Cloud Run enforces TLS 1.2+ on all ingress traffic   │
│       API keys never transmitted in cleartext              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Key Design Decisions

### 7.1 Why 8 Layers Instead of a Monolith?

A monolithic LLM chatbot would require a single prompt to handle resume critique, content evaluation, job alignment, and interview coaching simultaneously. This creates:
- **Prompt bloat**: Competing instructions degrade output quality for each task
- **No traceability**: A single response cannot attribute which part of the reasoning addressed which requirement
- **No governance granularity**: Hallucination or bias in one task contaminates all outputs
- **Poor testability**: A single agent cannot be unit-tested in isolation

The 8-layer architecture assigns each concern to a dedicated layer with a clear interface contract, enabling independent testing, replacement, and scaling.

### 7.2 Why LangGraph Over Simple Chains?

| Aspect | Simple Function Chain | LangGraph StateGraph |
|--------|----------------------|---------------------|
| Error recovery | Re-run entire chain | Resume from last checkpoint |
| Routing logic | Hard-coded if-else | Declarative conditional edges |
| Future parallelism | Requires refactor | Add parallel nodes with no API change |
| Observability | Custom logging required | Native Langfuse integration |
| State management | Manual dict passing | Typed `OrchestrationState` dataclass |

### 7.3 Why Governance as a Separate Layer (Not Inside Agents)?

Embedding governance checks inside each agent would require every agent to duplicate hallucination assessment logic, confidence threshold logic, and metadata schema management. The centralised `SharpGovernanceService` provides:
- **Consistency**: Same thresholds applied to all agents
- **Non-bypassable**: Governance runs in the orchestration loop after every agent, not optionally inside agent code
- **Auditability**: All governance decisions flow through one place, making audit trail generation straightforward

### 7.4 Why In-Memory Session Store (Not Database)?

At the current scale (demo + prototype), an in-memory `SessionStore` in `persistence.py` avoids infrastructure overhead. The abstraction layer means a database backend (Redis, PostgreSQL) can be substituted without changing agent or orchestration code. Cloud Run's 4 GiB RAM allocation comfortably holds hundreds of concurrent sessions.

### 7.5 Why Voice as a WebSocket Relay (Not Local STT)?

Running a local speech-to-text pipeline would require:
- A dedicated STT model (e.g., Whisper) loaded into the container
- Separate TTS for AI responses
- Chunking and streaming logic

Relaying audio directly to Gemini Live API eliminates all three requirements. The backend acts as a secure WebSocket relay, injecting the resume/JD system instruction before connecting the browser audio stream to the Gemini Live session.

---

*This document reflects the architecture as implemented in the `sit` branch. See [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md) for the physical/infrastructure view and [`AGENT_DESIGN.md`](AGENT_DESIGN.md) for per-agent internal design.*
