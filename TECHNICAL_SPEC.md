**TECHNICAL_SPEC.md: Persistent InterviewReady (Job Agent System)**

**1. Project Overview**

A high-integrity, multi-agent AI system for resume optimization using the **Diagnostic-Actuation-Audit** pattern. The system converts unstructured resumes into optimized, job-aligned documents through **LangGraph-based orchestration** with integrated feedback loops. Every change is justified mathematically via SHAP and verified with NLI.

**2. System Overview**

A **stateful, multi-agent orchestration pipeline** that uses LangGraph for persistent state management and agent coordination. The system implements the Diagnostic-Actuation-Audit cycle with mathematical justification through SHAP analysis and verification via Natural Language Inference (NLI).

**3. High-Level Architecture**

**LangGraph-based stateful graph** with integrated feedback loops and persistence.

- **State Management:** Checkpointer + Store pattern for short-term and long-term persistence
- **Diagnostic Engine:** Router + Scorer + Explainability Agents
- **Actuator:** Optimization Agent (LLM-driven) and Interviewer Agent (ReAct-based)
- **Auditor:** Validation Agent (Deterministic + NLI)
- **Observer:** LangFuse traces all state transitions and agent decisions
- **Human-in-the-Loop:** Strategic interrupts for user approval at critical points

**4. Data Flow & Component Interaction**

| **Step** | **Component**                          | **Input**                    | **Output**                                 | **Responsibility**                                                    |
| -------- | ------------------------------------- | ---------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| 1        | Extractor                             | Raw text/PDF                 | ResumeSchema                              | Schema enforcement + confidence scoring                             |
| 2        | Router                                | ResumeSchema + JD            | Next agent/HITL                           | Determines workflow path; flags stale resumes                        |
| 3        | ResumeCriticAgent                    | ResumeSchema                 | StructuralAssessment                      | Evaluates formatting, structure, ATS readability                    |
| 4        | ContentStrengthSkillsReasoningAgent   | ResumeSchema                 | ContentAnalysisReport                     | Analyzes skills, achievements, impact evidence                      |
| 5        | JobDescriptionAlignmentAgent          | ResumeSchema + JD            | AlignmentReport                           | Semantic matching, role fit assessment                              |
| 6        | InterviewCoachFeedbackAgent          | AlignmentReport + GapReport  | InterviewScenarios + ResponseFeedback     | Generates role-specific questions and evaluates responses            |
| 7        | Validator                            | Agent outputs                | ApprovalStatus                           | NLI entailment + integrity hash checks                               |

**5. Agents & Workflow (Technical Implementation)**

| **Agent**                              | **Type**          | **Function**                                                              | **Input**                  | **Output**                                      | **Technical Notes**                                  |
| -------------------------------------- | ----------------- | ------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------- | --------------------------------------------------- |
| ExtractorAgent                         | Deterministic/LLM | Parses PDFs into structured ResumeSchema                                  | PDF                        | ResumeSchema + timestamp                        | Uses LlamaParse for Markdown-centric parsing         |
| Router                                 | Logic-Gate        | Determines next action based on state                                     | Resume, JD                 | Next agent or HITL interrupt                    | Flags resumes >3 months as "stale"                   |
| ResumeCriticAgent                      | Analytical        | Evaluates structural quality, clarity, formatting from recruiter's perspective | ResumeSchema               | StructuralAssessment + FormatRecommendations     | ATS readability scoring, formatting consistency checks |
| ContentStrengthSkillsReasoningAgent     | Analytical        | Analyzes resume to identify key skills, achievements and evidence of impact   | ResumeSchema               | ContentAnalysisReport + SkillGapAssessment       | STAR/XYZ methodology, achievement quantification      |
| JobDescriptionAlignmentAgent            | Analytical        | Compares resume content with job description requirements to assess role fit | ResumeSchema, JD           | AlignmentReport + MissingKeywordsAnalysis        | Semantic matching, role-specific alignment scoring     |
| InterviewCoachFeedbackAgent            | ReAct             | Simulates role-specific interview scenarios and evaluates candidate responses | AlignmentReport, GapReport | InterviewScenarios + ResponseFeedback            | Behavioral/technical question generation, real-time coaching |
| Validator                              | Analytical        | Checks outputs internally                                                 | Agent outputs              | Hallucination flags, NLI validation             | DeBERTa-v3-large-mnli for NLI                        |

**6. Scoring Formula**

Weighted deterministic function for stable targets:

- **Jaccard similarity** of keywords
- **Semantic alignment** via sentence-transformers embeddings
- **Years-of-experience gap** analysis
- **Composite score** with version-controlled weights in core/engine.py

Ensures reproducible results for SHAP analysis and CI regression testing.

**7. Technical Stack**

- **Orchestration:** LangGraph (stateful graph cycles)
- **Parsing:** LlamaParse (Markdown-centric PDF parsing)
- **Database:** PostgreSQL + pgvector for vector similarity search
- **LLMs:** GPT-4o or Claude 3.5 Sonnet
- **Embeddings:** sentence-transformers/all-MiniLM-L6-v2
- **Explainability:** SHAP KernelExplainer
- **Integrity:** DeBERTa-v3-large-mnli (NLI)
- **Observability:** LangFuse (E2E monitoring, cost tracking)
- **Schema Enforcement:** Pydantic V2
- **State Management:** Memory-augmented routing with Checkpointer + Store

**8. Persistence Layer Architecture**

**8.1 Checkpointer (Short-term)**

- SQLite/PostgreSQL-based state checkpointing
- Stores agent execution state for session recovery
- Enables LangGraph workflow interruption and resumption
- Automatic checkpoint creation at each agent transition

**8.2 Store (Long-term)**

- PostgreSQL + pgvector for structured resume storage
- Vector embeddings for semantic search and matching
- Timestamp metadata with every resume version
- Supports resume history and version comparison

**8.3 State Management Technical Implementation**

- **Shared State Schema:** Enforced via Pydantic V2 models
- **Immutable Updates:** Agents append or update sub-keys only
- **State Transitions:** Logged with trace_id for debugging
- **Recovery Mechanism:** Exact session state restoration from database

**9. Database Requirements**

**9.1 Schema Requirements**

```sql
-- Resume storage with versioning
resumes (id, user_id, content_vector, metadata, created_at, updated_at)

-- Job descriptions for matching
job_descriptions (id, content_vector, metadata, created_at)

-- Agent execution checkpoints
checkpoints (thread_id, checkpoint_id, state_data, timestamp)

-- LangFuse integration traces
traces (trace_id, agent_name, input, output, metadata)
```

**9.2 Vector Storage**

- pgvector extension for semantic similarity
- 384-dimensional embeddings (all-MiniLM-L6-v2)
- Indexing for efficient resume-JD matching
- Support for hybrid search (keyword + semantic)

**10. Memory & State Management**

- **Agent Communication:** Pydantic V2 schemas only; raw strings forbidden
- **State Mutation Pattern:** `state.update({'key': value})` never `state = new_state`
- **Checkpoint Strategy:** After each agent completion and before HITL interrupts
- **State Recovery:** Load from latest checkpoint by thread_id
- **Concurrent Sessions:** Isolated state per user thread

**11. Optimization Loop & Retry Mechanism**

- **Validation Failure:**
  - Log violation to LangFuse with detailed reasoning
  - Reattempt Optimizer with specific feedback
  - Cease after 2 failures; revert to baseline to avoid hallucination
- **Interview Flow:**
  - Maintain conversation state across question-answer cycles
  - Gap-aware question generation based on SHAP analysis
  - Session persistence for asynchronous interviews

**12. LangFuse Integration Points**

- **Trace Naming:** Match agent class names (e.g., "OptimizerAgent")
- **Span Categories:**
  - `llm` for LLM calls with prompt/response logging
  - `agent` for decision logic and state transitions
  - `validation` for NLI and integrity checks
- **Metrics Export:**
  - Baseline and final scores with feature vectors
  - SHAP values for explainability analysis
  - Cost tracking per agent and per session
- **Debug Support:** Local replay via trace_id for failure analysis

**13. Directory Structure**

```
/agents/                    # Business logic for AI roles
├── base.py                # Abstract base class
├── extractor.py           # Parsing logic
├── router.py              # Workflow routing and stale detection
├── resume_critic.py       # Structural quality and formatting analysis
├── content_strength.py    # Skills reasoning and achievement analysis
├── jd_alignment.py        # Job description matching and alignment
├── interview_coach.py     # Interview simulation and feedback
└── validator.py           # NLI & integrity checks

/core/                     # Shared domain logic
├── schema.py              # Pydantic V2 models (SSOT)
├── engine.py              # Scoring coefficients & formulas
├── constants.py           # Taxonomy & immutable fields
└── database.py            # Database models and connections

/utils/                    # Shared utilities
├── nli_client.py          # Natural Language Inference client
├── observability.py       # LangFuse integration
├── embeddings.py          # Vector generation and similarity
└── state_manager.py       # Checkpointer and Store operations

/storage/                  # Data persistence
├── checkpointer.py        # State checkpoint management
├── store.py              # Long-term data storage
└── migrations/           # Database schema migrations

/tests/
├── unit/                 # Logic tests
├── integration/          # Pipeline flow tests
└── e2e/                  # "Golden Set" Resume/JD pairs

pipeline.py               # LangGraph orchestration entry point
pyproject.toml            # Project configuration
```

**14. Development Commands**

| **Task**           | **Command**                                                     |
| ------------------ | --------------------------------------------------------------- |
| Setup              | uv sync                                                         |
| Database Migration | python -m storage.migrations upgrade                            |
| Run Pipeline       | python pipeline.py --resume path/to/res.pdf --jd path/to/jd.txt |
| Lint               | ruff check .                                                    |
| Format             | ruff format .                                                   |
| Type Check         | mypy .                                                          |
| Test               | pytest tests/                                                   |
| LangFuse Local     | langfuse-server --config langfuse.config.yaml                   |

**15. Naming Conventions**

- **Agent Classes:** Suffix Agent (e.g., ScorerAgent, InterviewerAgent)
- **Agent Methods:** Primary entry point must be async def run(state)
- **State Keys:** snake_case (e.g., gap_report, optimization_suggestions)
- **Files:** Snake case (e.g., optimization_agent.py)
- **Constants:** Uppercase snake case (e.g., MIN_ENTAILMENT_THRESHOLD = 0.85)
- **Database Tables:** snake_case plural (e.g., resumes, job_descriptions)
- **LangFuse Traces:** Trace names match agent class

**16. Type Safety & Schema**

- **Data Models:** All data must use **Pydantic V2 models**; raw dicts forbidden
- **Strict Validation:** Fields constrained (e.g., confidence 0.0-1.0, positive scores)
- **Schema Evolution:** Use Pydantic's discriminated unions for versioning
- **Database Models:** SQLAlchemy models mirroring Pydantic schemas
- **State Schema:** Central SharedState class in core/schema.py
- **ValidationAgent:** Performs deep schema check before pipeline completion

**17. Testing Standards**

**17.1 Unit Tests**

- **Scorer:** Same Resume/JD always produces identical result (deterministic)
- **Router:** Consistent routing decisions for identical state
- **Integrity:** Modifying date triggers Validator violation
- **Agent Mocking:** pytest-mock for LLM calls; no live APIs

**17.2 Integration Tests**

- **State Flow:** Checkpoint creation and restoration
- **Database Operations:** CRUD operations with vector similarity
- **Agent Communication:** Pydantic schema validation across agents
- **HITL Workflow:** State transitions during user interrupts

**17.3 Golden Set E2E Tests**

- **Regression Tests:** Predefined Resume/JD pairs with expected outcomes
- **Score Thresholds:** Block PR if overall_fit score drops >5%
- **Validation Coverage:** All agent outputs pass ValidationAgent checks
- **LLM Calls:** Only E2E tests trigger live LLM APIs

**18. Continuous Integration (CI)**

- **Lint & Format:** Ruff with strict configuration
- **Static Analysis:** Mypy with strict type checking
- **Core Tests:** Pytest (unit + integration)
- **Database Tests:** Migration validation with test database
- **LangFuse Eval:** Subset run as CI Experiment to track drift
- **Golden Set Regression:** Automated score comparison
- **Security Scan:** PII detection and secrets scanning

**19. Debugging Practices**

- **Observability First:** LangFuse traces over print statements
- **Local Replay:** Use trace_id to replay failed executions
- **State Inspection:** Checkpoint viewer for debugging state issues
- **SHAP Visualization:** Feature importance analysis for scoring issues
- **Database Queries:** SQL logging for vector search debugging
- **Agent Logs:** Structured logging with correlation IDs

**20. Security & Privacy**

- **PII Masking:** Names, contact info masked before optimization
- **Data Encryption:** Encrypted connections to database and LLMs
- **Access Control:** User-scoped data access via user_id
- **Audit Trail:** Complete agent decision logging in LangFuse
- **Deterministic Weights:** Stored in core/engine.py, version-controlled
- **Secrets Management:** Environment variables for API keys and credentials

**21. Adding New Features / Agents**

1. **Schema Updates:** Extend core/schema.py with new state fields
2. **Agent Implementation:** Inherit from AgentBase in agents/base.py
3. **LangFuse Integration:** Initialize trace in async def run(state)
4. **Database Changes:** Create migration in storage/migrations/
5. **State Management:** Follow immutable update pattern
6. **Validation:** Ensure ValidationAgent checks new feature integrity
7. **Testing:** Add unit, integration, and golden set tests
8. **Documentation:** Update this TECHNICAL_SPEC.md

**22. Performance Requirements**

- **Resume Analysis:** <5s for scoring and gap analysis
- **Optimization:** <10s for suggestion generation
- **Database Queries:** <100ms for vector similarity search
- **State Recovery:** <2s for session restoration
- **Concurrent Users:** Support 100+ simultaneous sessions

**23. Deployment Architecture**

- **Application:** FastAPI with LangGraph runtime
- **Database:** PostgreSQL 15+ with pgvector extension
- **Caching:** Redis for session state and LLM response caching
- **Monitoring:** LangFuse cloud or self-hosted
- **Load Balancing:** Horizontal scaling for API endpoints
- **Storage:** S3-compatible storage for uploaded PDFs
