"""Session storage backend for API endpoints.

PostgreSQL-only: :class:`DatabaseSessionStore` persists user-owned session
contexts via :class:`app.db.session`. There is deliberately no in-memory
fallback — sessions require ``DATABASE_URL`` and the app fails fast at startup
when it is not configured.
"""

from __future__ import annotations

import contextlib
import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError

from app.core.logging import logger
from app.db.models import SessionModel
from app.db.session import async_session_factory
from app.models import AgentResponse, SessionContext

SESSION_EXPIRY_SECONDS = 3600
_MAX_SESSION_ID_ATTEMPTS = 100


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)  # noqa: UP017 (datetime.UTC absent in this interpreter)


def _to_model(context: SessionContext) -> SessionModel:
    """Serialize a session context into a SessionModel row."""
    return SessionModel(
        id=context.session_id,
        user_id=context.user_id,
        shared_memory=context.shared_memory,
        history=[response.model_dump(mode="json") for response in (context.history or [])],
        decision_trace=context.decision_trace,
        resume_data=context.resume_data,
        job_description=context.job_description,
        last_active_at=_utcnow(),
    )


def _to_context(row: SessionModel) -> SessionContext:
    """Deserialize a SessionModel row into a session context."""
    history: list[AgentResponse] = []
    for item in row.history or []:
        try:
            history.append(AgentResponse.model_validate(item))
        except Exception as exc:
            # Skip entries that no longer validate against the current schema.
            logger.warning(f"Skipping invalid session history entry in {row.id}: {exc}")
    return SessionContext(
        session_id=row.id,
        user_id=row.user_id,
        shared_memory=dict(row.shared_memory or {}),
        history=history,
        decision_trace=list(row.decision_trace or []),
        resume_data=row.resume_data,
        job_description=row.job_description,
    )


class SessionStore(ABC):
    """Interface for user-owned session context storage."""

    @abstractmethod
    async def create_session(self, user_id: str) -> tuple[str, SessionContext]:
        """Create a new session and return the session ID and context."""

    @abstractmethod
    async def get_or_create(self, session_id: str, user_id: str) -> SessionContext:
        """Return existing session context or create one for the requesting user."""

    @abstractmethod
    async def get(self, session_id: str, user_id: str) -> SessionContext | None:
        """Return existing session context for the requesting user, if any."""

    @abstractmethod
    async def save(self, context: SessionContext) -> None:
        """Persist the (possibly mutated) session context."""

    @abstractmethod
    async def delete(self, session_id: str, user_id: str) -> bool:
        """Delete a session owned by *user_id*; return True if a row was removed."""

    @abstractmethod
    async def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions and return count of removed sessions."""



class DatabaseSessionStore(SessionStore):
    """PostgreSQL-backed store for user-owned session contexts."""

    async def create_session(self, user_id: str) -> tuple[str, SessionContext]:
        """Create a new session and return the session ID and context."""
        for _ in range(_MAX_SESSION_ID_ATTEMPTS):
            session_id = f"session_{uuid.uuid4().hex[:16]}"
            context = SessionContext(session_id=session_id, user_id=user_id)
            try:
                await self._insert(context)
            except IntegrityError:
                continue
            # Best-effort sweep keeps the sessions table bounded without a scheduler.
            with contextlib.suppress(Exception):
                await self.cleanup_expired_sessions()
            return session_id, context
        msg = "Failed to allocate a unique session ID"
        raise RuntimeError(msg)

    async def get_or_create(self, session_id: str, user_id: str) -> SessionContext:
        """Return existing session context or create one for the requesting user."""
        context = await self._fetch(session_id, user_id)
        if context is not None:
            return context

        context = SessionContext(session_id=session_id, user_id=user_id)
        try:
            await self._insert(context)
        except IntegrityError:
            # Lost a concurrent create race; return the winning row (may raise
            # PermissionError if it belongs to another user).
            return await self._fetch(session_id, user_id)
        return context

    async def get(self, session_id: str, user_id: str) -> SessionContext | None:
        """Return existing session context for the requesting user, if any."""
        return await self._fetch(session_id, user_id)

    async def save(self, context: SessionContext) -> None:
        """Persist the (possibly mutated) session context via upsert."""
        if context.session_id is None:
            return
        async with async_session_factory() as session:
            await session.merge(_to_model(context))
            await session.commit()

    async def delete(self, session_id: str, user_id: str) -> bool:
        """Delete the session row only if it belongs to *user_id*."""
        async with async_session_factory() as session:
            result = await session.execute(
                delete(SessionModel).where(
                    SessionModel.id == session_id,
                    SessionModel.user_id == user_id,
                )
            )
            await session.commit()
            return (result.rowcount or 0) > 0

    async def cleanup_expired_sessions(self) -> int:
        """Remove expired sessions and return count of removed sessions."""
        cutoff = _utcnow() - timedelta(seconds=SESSION_EXPIRY_SECONDS)
        async with async_session_factory() as session:
            result = await session.execute(delete(SessionModel).where(SessionModel.last_active_at < cutoff))
            await session.commit()
            return result.rowcount or 0

    async def _insert(self, context: SessionContext) -> None:
        async with async_session_factory() as session:
            session.add(_to_model(context))
            await session.commit()

    async def _fetch(self, session_id: str, user_id: str) -> SessionContext | None:
        async with async_session_factory() as session:
            row = await session.get(SessionModel, session_id)

        if row is None:
            return None
        if row.user_id != user_id:
            msg = "Unauthorized access to session"
            raise PermissionError(msg)

        await self._touch(session_id)
        return _to_context(row)

    async def _touch(self, session_id: str) -> None:
        async with async_session_factory() as session:
            await session.execute(
                update(SessionModel).where(SessionModel.id == session_id).values(last_active_at=_utcnow())
            )
            await session.commit()


def build_session_store() -> SessionStore:
    """Return the PostgreSQL-backed session store.

    PostgreSQL is a hard requirement: there is no in-memory fallback. Raises
    :class:`RuntimeError` when the database layer is unavailable so the app
    fails fast at startup instead of silently running without persistence.
    """
    if async_session_factory is None:
        msg = (
            "Sessions require DATABASE_URL to be configured: "
            "PostgreSQL is mandatory, there is no in-memory fallback."
        )
        raise RuntimeError(msg)
    return DatabaseSessionStore()
