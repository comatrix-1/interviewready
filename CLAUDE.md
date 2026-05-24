# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- **Install dependencies**: `uv sync`
- **Run the backend**: `uv run python -m app.main`
- **Run tests**: `uv run pytest`
- **Run a single test**: `uv run pytest path/to/test_file.py::test_name`
- **Lint / format**: `uv run ruff check . && uv run ruff format .`
- **Type checking**: `uv run mypy .`
- **Start API docs**: after running the app, open `http://localhost:8000/docs`
- **Run with mock agents**: set env vars `MOCK_RESUME_CRITIC_AGENT=true` etc. before starting the app.

## High‑Level Architecture

The repository implements a production‑grade multi‑agent AI evaluation system built with FastAPI and LangGraph.

- **FastAPI entry point** (`app/main.py`) runs the HTTP server.
- **Orchestration layer** (`app/orchestration/orchestration_agent.py`) extracts intent, normalises inputs, and routes requests to the appropriate agent.
- **Agent layer** (`app/agents/`) contains specialised agents (ResumeCritic, ContentStrength, JobAlignment, InterviewCoach). All agents inherit from `BaseAgent` which provides:
  - LLM Guard input scanning for prompt‑injection safety.
  - PII redaction on outputs.
  - Structured logging and Langfuse tracing.
  - Governance audit via the SHARP service.
- **Governance layer** (`app/governance/sharp_governance_service.py`) validates confidence, detects hallucination and bias, and may flag a request for human review.
- **Security layer** (`app/security/`) houses the LLM Guard scanner and output sanitiser.
- **Configuration** (`app/core/config.py`) loads settings from `.env` using `pydantic-settings`.
- **Observability** integrates Langfuse for end‑to‑end tracing of each agent’s processing steps.
- **Database** uses SQLAlchemy async ORM for persisting session state and evaluation results.

### Data Flow (request → response)
1. **HTTP request** hits `/api/v1/chat`.
2. Orchestration extracts intent and normalises the resume.
3. Selected agent processes the input (LLM Guard → Gemini call → output sanitisation).
4. Governance audits the agent response.
5. Langfuse records a trace of all steps.
6. Response payload, confidence score, and decision trace are returned to the client.

## Important Files
- `backend/app/main.py` – FastAPI app startup.
- `backend/app/api/v1/endpoints/chat.py` – Chat endpoint definition.
- `backend/app/agents/*` – Individual agent implementations.
- `backend/app/governance/sharp_governance_service.py` – Governance logic.
- `backend/app/security/llm_guard_scanner.py` – Prompt‑injection defense.
- `backend/app/core/config.py` – Central configuration.
- `backend/tests/` – Full test suite covering agents, orchestration, security, and API.

## Development Tips
- Enable **mock mode** via the `MOCK_…` environment variables to avoid real LLM calls during local development.
- Use **Langfuse** dashboards to inspect traces when debugging agent behaviour.
- Security checks are enforced automatically by `BaseAgent`; do not bypass them.
- The project follows a strict **structured‑output** contract for each agent – refer to the response format tables in the backend README when adding new agents.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
