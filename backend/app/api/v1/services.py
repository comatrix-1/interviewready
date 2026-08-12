"""API service dependencies for orchestration and session management."""

from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

from fastapi import Request

from app.agents import (
    AgentRegistry,
    GeminiService,
)
from app.db.session_store import SessionStore, build_session_store
from app.db.user_store import UserStore, build_user_store
from app.governance import SharpGovernanceService
from app.orchestration import OrchestrationAgent

if TYPE_CHECKING:
    from app.models import SessionContext

# Fallback identity until real authentication is implemented.
DEFAULT_USER_ID = "dev-user"

_session_store = build_session_store()
_user_store = build_user_store()


def resolve_user_id(request: Request) -> str:
    """Resolve the acting user id from the ``X-User-Id`` header (fallback: dev-user)."""
    return (request.headers.get("X-User-Id") or "").strip() or DEFAULT_USER_ID


def get_user_store() -> UserStore:
    """Return the user store instance."""
    return _user_store


def get_session_store() -> SessionStore:
    """Return the session store instance."""
    return _session_store


@lru_cache(maxsize=1)
def get_orchestration_agent() -> OrchestrationAgent:
    """Build and cache the orchestration agent graph and dependencies."""
    gemini_service = GeminiService()
    governance = SharpGovernanceService()
    registry = AgentRegistry()
    agents = registry.build_agents(gemini_service)
    return OrchestrationAgent(
        agent_list=agents,
        governance=governance,
    )


async def get_or_create_session_context(session_id: str, user_id: str) -> SessionContext:
    """Return existing session context or create it for this user."""
    return await _session_store.get_or_create(session_id=session_id, user_id=user_id)


async def get_session_context(session_id: str, user_id: str) -> SessionContext | None:
    """Return existing session context for this user, if present."""
    return await _session_store.get(session_id=session_id, user_id=user_id)
