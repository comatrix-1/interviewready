"""User storage backends for simulated login/registration.

Two implementations of the same async interface:

- :class:`MemoryUserStore` — in-memory registry (DB-free fallback).
- :class:`DatabaseUserStore` — PostgreSQL-backed via :class:`app.db.session`.

Use :func:`build_user_store` to pick the active backend based on whether
``DATABASE_URL`` is configured.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from threading import RLock

from sqlalchemy.exc import IntegrityError

from app.db.models import UserModel
from app.db.session import async_session_factory


class UserStore(ABC):
    """Interface for user registration lookups."""

    @abstractmethod
    async def get_or_create(self, username: str) -> bool:
        """Ensure a user row exists; return True if it was newly created."""


class MemoryUserStore(UserStore):
    """In-memory registry of registered usernames."""

    def __init__(self) -> None:
        self._usernames: set[str] = set()
        self._lock = RLock()

    async def get_or_create(self, username: str) -> bool:
        """Register the username if unknown; return True when newly created."""
        with self._lock:
            if username in self._usernames:
                return False
            self._usernames.add(username)
            return True


class DatabaseUserStore(UserStore):
    """PostgreSQL-backed store for registered users."""

    async def get_or_create(self, username: str) -> bool:
        """Insert the user row if it doesn't exist; return True when newly created."""
        async with async_session_factory() as session:
            if await session.get(UserModel, username) is not None:
                return False
            try:
                session.add(UserModel(username=username))
                await session.commit()
                return True
            except IntegrityError:
                # Lost a concurrent create race; the user already exists.
                await session.rollback()
                return False


def build_user_store() -> UserStore:
    """Return the active user store backend (database when configured)."""
    if async_session_factory is not None:
        return DatabaseUserStore()
    return MemoryUserStore()
