# InterviewReady Agent Development Guide

## Repository Layout
- `backend/`: Core Python backend with LangGraph orchestration and multi-agent pipeline
  - `agents/`: Individual agent implementations (ExtractorAgent, ResumeCriticAgent, etc.)
  - `core/`: Shared domain logic, schemas, and data models
  - `storage/`: PostgreSQL models, migrations, and vector similarity operations
  - `utils/`: Utilities for NLI, embeddings, SHAP analysis, and other ML operations
  - `api/`: FastAPI endpoints for external communication
  - `tests/`: Unit, integration, and end-to-end tests
  - `pipeline.py`: LangGraph orchestration entry point
- `frontend/`: React TypeScript client for user interface
  - `src/components/`: React UI components
  - `src/services/`: API client services
  - `src/store/`: State management
  - `src/types/`: TypeScript type definitions
- `docs/`: Project documentation (PRD, Technical Spec, Status)
- `.agents/` and `.agent/`: Agent-specific configuration and metadata

## Development Commands
| Task | Command |
|------|---------|
| Setup Dependencies | `uv sync` |
| Database Migration | `python -m storage.migrations upgrade` |
| Run Pipeline | `python pipeline.py --resume path/to/res.pdf --jd path/to/jd.txt` |
| Code Linting | `ruff check .` |
| Code Formatting | `ruff format .` |
| Type Checking | `mypy .` |
| Run Tests | `pytest tests/` |
| Frontend Dev | `cd frontend && npm run dev` |
| LangFuse Local | `langfuse-server --config langfuse.config.yaml` |

## Agent Development Guidelines

### Agent Implementation Standards
- **State Management**: Use LangGraph's persistent state with checkpoint-based recovery
- **Mathematical Justification**: Implement SHAP-based feature importance analysis for scoring
- **Validation**: All outputs must pass NLI-based integrity checking
- **Logging**: Complete agent decision logging for audit trails
- **Error Handling**: Graceful degradation with clear error messages

### Code Style & Conventions
- **Python**: Follow PEP 8, use Pydantic V2 for schemas, type hints required
- **TypeScript**: Use functional React components, 2-space indentation, single quotes
- **Naming**: Agent files in `PascalCase` (e.g., `ExtractorAgent.py`), functions in `snake_case`
- **Testing**: Each agent requires unit tests and integration tests

### Testing Strategy
- **Unit Tests**: Agent logic, deterministic scoring formulas
- **Integration Tests**: State flow, database operations, agent coordination
- **Golden Set E2E**: Regression testing with predefined resume/JD pairs
- **Performance Tests**: Resume analysis <5s, optimization <10s, queries <100ms

## Commit Messages and Pull Requests
- Follow the [Chris Beams](http://chris.beams.io/posts/git-commit/) style for commit messages.
- Every PR should address:
  - **What changed?**
  - **Why?**
  - **Breaking changes?**
- Reference relevant issues and include reproduction steps

For detailed technical specifications, see `docs/TECHNICAL_SPEC.md`. For project status, see `docs/STATUS.md`.
