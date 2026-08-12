"""Saved-resume storage backed by PostgreSQL.

PostgreSQL-only: there is deliberately no in-memory fallback. Saved resumes are
available only when ``DATABASE_URL`` is configured; without it
:class:`ResumePersistenceUnavailableError` is raised.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import SavedResumeModel
from app.db.session import async_session_factory
from app.models import Resume


class ResumePersistenceUnavailableError(RuntimeError):
    """Raised when saved-resume persistence is requested without DATABASE_URL."""


@dataclass(frozen=True)
class SavedResumeRecord:
    """An immutable saved-resume snapshot."""

    id: str
    filename: str
    created_at: datetime
    resume: Resume


class ResumeStore(ABC):
    """Interface for saved-resume persistence."""

    @abstractmethod
    async def create(self, *, user_id: str, filename: str, resume: Resume) -> SavedResumeRecord:
        """Persist a resume snapshot for the user and return the saved record."""

    @abstractmethod
    async def list_for_user(self, *, user_id: str) -> list[SavedResumeRecord]:
        """Return the user's saved resumes, newest first."""


class DatabaseResumeStore(ResumeStore):
    """PostgreSQL-backed store for saved resume snapshots."""

    def __init__(self, session_factory: async_sessionmaker[AsyncSession]) -> None:
        self._session_factory = session_factory

    async def create(self, *, user_id: str, filename: str, resume: Resume) -> SavedResumeRecord:
        row = SavedResumeModel(
            id=str(uuid4()),
            user_id=user_id,
            filename=filename,
            resume_data=resume.model_dump(mode="json"),
        )
        async with self._session_factory() as session:
            session.add(row)
            await session.commit()
            await session.refresh(row)  # load server-generated created_at
        return SavedResumeRecord(
            id=row.id,
            filename=row.filename,
            created_at=row.created_at,
            resume=Resume.model_validate(row.resume_data),
        )

    async def list_for_user(self, *, user_id: str) -> list[SavedResumeRecord]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SavedResumeModel)
                .where(SavedResumeModel.user_id == user_id)
                .order_by(SavedResumeModel.created_at.desc(), SavedResumeModel.id.desc())
            )
            rows = result.scalars().all()
        return [
            SavedResumeRecord(
                id=row.id,
                filename=row.filename,
                created_at=row.created_at,
                resume=Resume.model_validate(row.resume_data),
            )
            for row in rows
        ]


def build_resume_store() -> ResumeStore:
    """Return the active saved-resume store backend.

    Raises :class:`ResumePersistenceUnavailableError` when ``DATABASE_URL`` is
    not configured; there is no memory implementation.
    """
    if async_session_factory is None:
        raise ResumePersistenceUnavailableError("Saved resumes require DATABASE_URL to be configured.")
    return DatabaseResumeStore(async_session_factory)
