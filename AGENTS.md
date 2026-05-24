## Codebase navigation with roam

This project uses `roam` for codebase comprehension. Always prefer roam over Glob/Grep/Read exploration.

Before modifying any code:
1. First time in the repo: `roam understand` then `roam tour`
2. Find a symbol: `roam search <pattern>`
3. Before changing a symbol: `roam preflight <name>` (blast radius + tests + fitness)
4. Need files to read: `roam context <name>` (files + line ranges, prioritized)
5. Debugging a failure: `roam diagnose <name>` (root cause ranking)
6. After making changes: `roam diff` (blast radius of uncommitted changes)

Additional commands: `roam health` (0-100 score), `roam impact <name>` (what breaks),
`roam pr-risk` (PR risk score), `roam file <path>` (file skeleton).

Run `roam --help` for all commands. Use `roam --json <cmd>` for structured output.

# Project Architecture

## Project Overview

- **Files:** 81
- **Symbols:** 635
- **Edges:** 300
- **Languages:** python (39), markdown (17), typescript (6), tsx (5), json (3), yaml (2), html (1), javascript (1)

## Directory Structure

| Directory | Files | Primary Language |
|-----------|-------|------------------|
| `backend/` | 44 | python |
| `frontend/` | 21 | typescript |
| `.agents/` | 8 | markdown |
| `./` | 5 | markdown |
| `docs/` | 2 | markdown |
| `.github/` | 1 | yaml |

## Entry Points

- `backend/app/__init__.py`
- `backend/app/agents/__init__.py`
- `backend/app/api/__init__.py`
- `backend/app/api/v1/__init__.py`
- `backend/app/api/v1/endpoints/__init__.py`
- `backend/app/core/__init__.py`
- `backend/app/governance/__init__.py`
- `backend/app/main.py`
- `backend/app/models/__init__.py`
- `backend/app/orchestration/__init__.py`
- `backend/app/utils/__init__.py`
- `backend/test_mock_mode.py`

## Key Abstractions

Top symbols by importance (PageRank):

| Symbol | Kind | Location |
|--------|------|----------|
| `App const App = () =>` | function | `frontend/App.tsx:27` |
| `SessionContext class SessionContext(BaseModel)` | class | `backend/app/models/session.py:8` |
| `AgentResponse class AgentResponse(BaseModel)` | class | `backend/app/models/agent.py:7` |
| `InterviewCoachAgent class InterviewCoachAgent(BaseAgent)` | class | `backend/app/agents/interview_coach.py:15` |
| `JobAlignmentAgent class JobAlignmentAgent(BaseAgent)` | class | `backend/app/agents/job_alignment.py:13` |
| `get_orchestration_agent @lru_cache(maxsize=1)
def get_orchestration_age...` | function | `backend/app/api/v1/services.py:23` |
| `ContentStrengthAgent class ContentStrengthAgent(BaseAgent)` | class | `backend/app/agents/content_strength.py:13` |
| `ResumeCriticAgent class ResumeCriticAgent(BaseAgent)` | class | `backend/app/agents/resume_critic.py:13` |
| `OrchestrationState class OrchestrationState(TypedDict)` | class | `backend/app/orchestration/orchestration_agent.py:22` |
| `BaseAgentProtocol class BaseAgentProtocol(Protocol)` | class | `backend/app/agents/base.py:13` |
| `SharpGovernanceService class SharpGovernanceService` | class | `backend/app/governance/sharp_governance_service.py:13` |
| `MockGeminiService class MockGeminiService` | class | `backend/app/agents/mock_gemini_service.py:10` |
| `GeminiService class GeminiService` | class | `backend/app/agents/gemini_service.py:13` |
| `Resume class Resume(BaseModel)` | class | `backend/app/models/resume.py:8` |
| `StubAgent class StubAgent` | class | `backend/tests/test_orchestration_governance.py:11` |

## Architecture

- **Dependency layers:** 8
- **Cycles (SCCs):** 0
- **Layer distribution:** L0: 533 symbols, L1: 31 symbols, L2: 28 symbols, L3: 22 symbols, L4: 6 symbols

## Testing

**Test directories:** `backend/tests/`, `frontend/tests/`
- **Test files:** 5
- **Source files:** 76
- **Test-to-source ratio:** 0.07

## Coding Conventions

Follow these conventions when writing code in this project:

- **Classes:** Use `PascalCase` (94% of 50 classes)
- **Methods:** Use `snake_case` (92% of 114 methods)
- **Imports:** Prefer absolute imports (100% are cross-directory)
- **Test files:** *.test.*, test_*.py

## Complexity Hotspots

Average function complexity: 2.5 (515 functions analyzed)

Functions with highest complexity (consider refactoring):

| Function | Complexity | Location |
|----------|-----------|----------|
| `App` | 130 | `frontend/App.tsx:27` |
| `test_agents` | 30 | `backend/tests/test_agents.py:17` |
| `process` | 26 | `backend/app/agents/interview_coach.py:50` |
| `_parse_json` | 25 | `backend/app/agents/job_alignment.py:59` |

## Domain Keywords

- **Top domain terms:** agent, alignment, orchestration, resume, interview, mock, service, strength, log, prompt, agents, step, chat, gemini, critic, system, confidence, certification, report, analysis

## Core Modules

Most-imported modules (everything depends on these):

| Module | Imported By | Symbols Used |
|--------|-------------|--------------|
| `backend/app/models/agent.py` | 16 files | 52 |
| `backend/app/models/session.py` | 12 files | 28 |
| `backend/app/core/logging.py` | 11 files | 15 |
| `backend/app/agents/base.py` | 5 files | 10 |
| `backend/app/agents/gemini_service.py` | 5 files | 9 |
| `backend/app/agents/mock_config.py` | 5 files | 11 |
| `backend/app/core/config.py` | 4 files | 4 |
| `backend/app/agents/content_strength.py` | 3 files | 6 |
| `backend/app/agents/interview_coach.py` | 3 files | 6 |
| `backend/app/agents/job_alignment.py` | 3 files | 6 |

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
