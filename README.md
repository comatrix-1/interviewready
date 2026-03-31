# InterviewReady

An intelligent multi-agent AI system for comprehensive resume optimization and interview preparation.

## 🎯 Objective

InterviewReady empowers job candidates to present their qualifications effectively through AI-powered analysis while ensuring fair, transparent, and governance-aligned guidance. Our multi-agent orchestration system evaluates resume quality, analyzes job alignment, and provides realistic interview coaching.

## 🏗️ Architecture & Design

For a comprehensive architectural overview, design decisions, technology justification, and implementation details, see:

**📖 [ARCHITECTURE.md](./ARCHITECTURE.md)** — Complete design document covering:
- Project objectives & scope
- Logical & physical architecture diagrams
- High-level workflow & agent system
- Explainable & responsible AI practices
- Security & risk mitigation
- Testing strategy

## 🚀 Quick Start

### Core Components

- **Multi-Agent System**: Specialized agents for resume analysis, alignment scoring, and interview coaching
- **Orchestration Engine**: LangGraph-based workflow with stateful session management
- **AI-Powered Governance**: Semantic intelligence services for bias detection, hallucination evaluation, explainability
- **SHARP Compliance Layer**: Fairness detection, transparency scoring, confidence validation
- **Structured Tracing**: Langfuse integration with complete audit trails
- **FastAPI Backend**: Async, type-safe REST API with automatic documentation

### Agent Overview

| Agent | Purpose | Output |
|-------|---------|--------|
| **ResumeCriticAgent** | Structural & ATS readability analysis | Markdown critique with scores |
| **ContentStrengthAgent** | Skills & achievements effectiveness | JSON with evidence-based suggestions |
| **JobAlignmentAgent** | Resume-to-JD semantic matching | JSON with fit scores & skill gaps |
| **InterviewCoachAgent** | Role-specific interview prep & coaching | Multi-turn interview with state tracking |

## 📁 Directory Structure

```
.
├── ARCHITECTURE.md              # Comprehensive architecture & design doc
├── backend/                     # Python FastAPI server
│   ├── app/
│   │   ├── agents/              # Agent implementations (ResumeCritic, ContentStrength, etc.)
│   │   ├── orchestration/       # LangGraph workflow orchestration
│   │   ├── governance/          # SHARP governance audit layer
│   │   ├── security/            # LLM Guard scanning & safety
│   │   ├── api/                 # FastAPI endpoints
│   │   └── core/                # Config, logging, constants
│   └── tests/                   # Unit, integration, security tests
├── frontend/                    # React TypeScript SPA
│   ├── components/              # Agent UI components
│   ├── contexts/                # React context providers
│   └── utils/                   # API client & helpers
└── evals/                       # Evaluation suite with Langfuse datasets
```

## 🛠️ Setup & Deployment

- **[Backend Setup & API Docs](backend/README.md)** — Python environment, agent configuration, API reference
- **[Frontend Setup](frontend/README.md)** — React build, integration with backend
- **[Deployment Guide](DEPLOYMENT.md)** — Docker, Cloud Run, Kubernetes options

## 📊 Key Features

✅ **AI-Powered Semantic Governance** — Bias detection, hallucination evaluation, explainability with ML embeddings  
✅ **Multi-Turn Interview Coaching** — Stateful interview sessions with answer evaluation  
✅ **Explainable Scoring** — Every decision traced with decision_trace & reasoning fields  
✅ **Semantic Bias Detection** — Protected attribute recognition & fairness flag generation  
✅ **Hallucination Safeguards** — Faithfulness evaluation & contradiction detection  
✅ **Decision Attribution** — Transparent factor analysis showing what influenced decisions  
✅ **Security First** — Prompt injection defense, PII redaction, output sanitization  
✅ **Full Auditability** — Langfuse tracing + JSON structured logging + governance metadata  
✅ **Graceful Fallbacks** — Mock response fallback when API unavailable  
✅ **Mock Mode** — Development & testing without live API calls

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Detailed design, rationale, tech stack & governance
- **[COMPREHENSIVE_TEST_REPORT.md](COMPREHENSIVE_TEST_REPORT.md)** — AI governance refactor validation & test results
- **[backend/README.md](backend/README.md)** — Backend API setup & configuration
- **[frontend/README.md](frontend/README.md)** — Frontend build & integration
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Container, Cloud Run, K8s deployment
- **[GOVERNANCE.md](GOVERNANCE.md)** — SHARP governance framework & AI services
- **[INTERVIEW_COACH_MODIFICATION.md](INTERVIEW_COACH_MODIFICATION.md)** — Interview coach customization

## 🧪 Evaluations

Comprehensive test suite evaluates agent performance on real-world and edge-case scenarios.

### Prerequisites
- Python 3.11+
- `GEMINI_API_KEY` and `LANGFUSE_PUBLIC_KEY` configured
- Dependencies: `uv sync`

### Running Evaluations

**Regular Cases:**
```bash
uv run python -m evals.run_evals --agent ResumeCriticAgent --max-cases 5
```

**Edge Cases:**
```bash
uv run python -m evals.run_evals --agent InterviewCoachAgent --edge-cases --max-cases 3
```

**All Agents with Langfuse Tracking:**
```bash
uv run python -m evals.run_evals --langfuse-dataset interviewready_cases --max-cases 1
```

### Available Agents for Evaluation
- `ResumeCriticAgent` — ATS & formatting analysis
- `ContentStrengthAgent` — Skill & achievement effectiveness
- `JobAlignmentAgent` — Resume-to-JD matching
- `InterviewCoachAgent` — Interview preparation & coaching

### Options
- `--agent` — Comma-separated agent names
- `--max-cases` — Limit test cases
- `--edge-cases` — Run edge case scenarios
- `--run-name` — Custom Langfuse run identifier

## 🔐 Security & Compliance

### Security Controls
- ✅ **Prompt Injection Defense** — LLM Guard input scanning + system prompt hardening
- ✅ **Output Sanitization** — Hallucination & leakage detection + contradiction checking
- ✅ **PII Redaction** — GDPR-compliant data masking before LLM calls
- ✅ **Auditable Decisions** — Complete trace of reasoning & changes in decision_trace
- ✅ **Rate Limiting** — Planned per-session quotas to prevent abuse

### AI Governance Services (Production-Ready)
- ✅ **BiasDetectionService** — Semantic bias detection with keyword fallback
  - Detects protected attributes: gender, age, race, religion, disability, family status, sexual orientation
  - Identifies bias signals: gendered language, ageist language, ability-based language
  - Risk scoring (0.0-1.0) with fairness concerns & recommendations

- ✅ **HallucinationEvaluationService** — Semantic faithfulness evaluation
  - Sentence-level semantic alignment
  - Per-claim contradiction detection
  - Self-consistency checking
  - Hallucination risk assessment (0.0-1.0)

- ✅ **ExplainabilityService** — Decision attribution & transparency
  - Factor influence detection
  - Transparency scoring (0.0-1.0)
  - Human-readable explanations (user/reviewer/auditor audiences)
  - Quality checklist generation

- ✅ **Governance Checks** — Confidence thresholds, hallucination risk assessment, IMDA compliance

**All services include graceful fallback modes** when sentence-transformers embeddings unavailable (works without GPU/internet).

See [ARCHITECTURE.md](./ARCHITECTURE.md#security--risk-mitigation) and [COMPREHENSIVE_TEST_REPORT.md](COMPREHENSIVE_TEST_REPORT.md) for comprehensive security controls, governance framework, and validation results.

## 🏃 Development Workflow

### Setup Local Environment

```bash
# Backend
cd backend
uv sync
cp .env.example .env
# Update .env with GEMINI_API_KEY, etc.

# Frontend
cd frontend
npm install
```

### Run Backend Locally

```bash
cd backend
uv run python -m app.main
# API available at http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Run Tests

```bash
cd backend

# All tests
uv run pytest

# Governance tests (new AI-powered services)
uv run pytest tests/test_orchestration_governance.py -v

# Unit tests only
uv run pytest backend/tests/ -k "not integration"

# Security tests
uv run pytest backend/tests/ -k "security or injection or sanitiz"

# Fallback mode validation
python test_fallback_modes.py

# With coverage
uv run pytest --cov=app
```

### Mock Mode (Development)

Enable in `.env` or `config.py`:
```
MOCK_INTERVIEW_COACH_AGENT=true
MOCK_CONTENT_STRENGTH_AGENT=false
MOCK_JOB_ALIGNMENT_AGENT=false
MOCK_RESUME_CRITIC_AGENT=false
```

## 📊 Monitoring & Analytics

- **[Langfuse Dashboard](https://cloud.langfuse.com)** — LLM traces, cost tracking, performance metrics
- **Structured Logs** — JSON format with session, agent, timing, and error context
- **Decision Traces** — Agent-level decision path auditing
- **Governance Metadata** — Bias flags, hallucination scores, confidence metrics

## 🤝 Contributing

See [AGENTS.md](./.agents/README.md) for agent customization guidelines and roam-based codebase navigation.

## 📦 Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | FastAPI + Uvicorn + Pydantic v2 |
| LLM | Google Gemini API 2.5 Flash |
| Orchestration | LangGraph || AI Governance | sentence-transformers (all-MiniLM-L6-v2) + scikit-learn + numpy || Security | LLM Guard Scanner + Output Sanitizer |
| Observability | Langfuse + Structured JSON Logging |
| Testing | pytest + pytest-asyncio |
| Deployment | Docker + Cloud Run / K8s |
| Package Manager | uv |

For detailed rationale and architecture justification, see [ARCHITECTURE.md](./ARCHITECTURE.md#technology-stack).

## 📄 License

[Add your license here]

## 👥 Support

For architecture questions, refer to [ARCHITECTURE.md](./ARCHITECTURE.md).  
For API issues, see [backend/README.md](backend/README.md).  
For UI issues, see [frontend/README.md](frontend/README.md).

- `--langfuse-dataset` - Specify Langfuse dataset name
- `--sync-langfuse-dataset` - Upload local cases to Langfuse

### Evaluation Datasets

#### Regular Datasets
- `evals/datasets/resumes.json` - Standard resume fixtures
- `evals/datasets/job_descriptions.json` - Standard job descriptions
- `evals/datasets/histories.json` - Standard conversation histories
- `evals/datasets/cases.json` - Standard evaluation cases

#### Edge Case Datasets
- `evals/datasets/edge_case_resumes.json` - Edge case resume fixtures
- `evals/datasets/edge_case_jobs.json` - Edge case job descriptions
- `evals/datasets/edge_case_histories.json` - Edge case conversation histories
- `evals/datasets/edge_case_cases.json` - Edge case evaluation scenarios

#### Edge Case Categories
- **No Resume Data**: Empty resumes, missing critical fields
- **Prompt Injection**: System override attempts, jailbreak attempts
- **Irrelevant Data**: Recipe content, code snippets instead of professional content
- **Context Flooding**: Extremely long resumes, massive job descriptions, long histories
- **Data Quality**: Malformed data, mixed languages, special characters
- **Edge Scenarios**: Missing job descriptions, contradictory information

### Langfuse Integration

Results are automatically tracked in Langfuse when `LANGFUSE_PUBLIC_KEY` is configured. Separate datasets can be synced:

```bash
# Sync regular cases
uv run python -m evals.run_evals --sync-langfuse-dataset "interviewready-regular"

# Sync edge cases  
uv run python -m evals.run_evals --edge-cases --sync-langfuse-dataset "interviewready-edge-cases"
```

## Deployment

### Local Development
```bash
docker-compose up --build --build-arg VITE_API_BASE_URL=localhost:8080
```
- Frontend: `http://localhost:80`
- Backend: `http://localhost:8080`

### Production Deployment
Automated deployment to GCP Cloud Run via GitHub Actions. See `.github/workflows/gcp-deploy.yaml` for configuration details.
