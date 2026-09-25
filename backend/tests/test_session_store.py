"""Tests for the PostgreSQL-only session store.

``test_build_session_store_raises_without_database`` is a pure unit test (no DB
needed). The ``DatabaseSessionStore`` integration tests below are skipped unless
``TEST_DATABASE_URL`` is set, mirroring ``tests/test_resume_store.py``.
"""

import os
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.db.session_store as session_store_module
from app.db.models import Base, SessionModel
from app.db.session_store import SESSION_EXPIRY_SECONDS, DatabaseSessionStore, build_session_store

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL/DATABASE_URL not set; requires a real PostgreSQL instance",
)


def test_build_session_store_raises_without_database(monkeypatch):
    monkeypatch.setattr(session_store_module, "async_session_factory", None)

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        build_session_store()


@pytest_asyncio.fixture
async def session_store(monkeypatch):
    """Yield a DatabaseSessionStore bound to a fresh disposable test database.

    DatabaseSessionStore reads the module-global ``async_session_factory``, so
    the fixture points it at an engine for the disposable test database.
    """
    assert TEST_DATABASE_URL  # guarded by the requires_db markers; narrows the type for mypy
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(session_store_module, "async_session_factory", factory)
    yield DatabaseSessionStore()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@requires_db
@pytest.mark.asyncio
async def test_create_and_get_round_trip(session_store):
    session_id, context = await session_store.create_session(user_id="alice")

    assert session_id.startswith("session_")
    assert context.user_id == "alice"

    loaded = await session_store.get(session_id=session_id, user_id="alice")
    assert loaded is not None
    assert loaded.session_id == session_id
    assert loaded.user_id == "alice"


@requires_db
@pytest.mark.asyncio
async def test_create_session_returns_unique_ids(session_store):
    first_id, _ = await session_store.create_session(user_id="alice")
    second_id, _ = await session_store.create_session(user_id="alice")

    assert first_id != second_id


@requires_db
@pytest.mark.asyncio
async def test_get_returns_none_for_unknown_session(session_store):
    assert await session_store.get(session_id="session_nope", user_id="alice") is None


@requires_db
@pytest.mark.asyncio
async def test_get_raises_permission_error_for_other_user(session_store):
    session_id, _ = await session_store.create_session(user_id="alice")

    with pytest.raises(PermissionError):
        await session_store.get(session_id=session_id, user_id="mallory")


@requires_db
@pytest.mark.asyncio
async def test_get_or_create_returns_existing_or_creates(session_store):
    session_id, _ = await session_store.create_session(user_id="alice")

    existing = await session_store.get_or_create(session_id=session_id, user_id="alice")
    assert existing.session_id == session_id

    created = await session_store.get_or_create(session_id="session_fresh", user_id="bob")
    assert created.session_id == "session_fresh"
    assert created.user_id == "bob"


@requires_db
@pytest.mark.asyncio
async def test_save_persists_mutations(session_store):
    session_id, context = await session_store.create_session(user_id="alice")

    context.shared_memory = {"interview_active": True, "question_index": 2}
    await session_store.save(context)

    loaded = await session_store.get(session_id=session_id, user_id="alice")
    assert loaded is not None
    assert loaded.shared_memory == {"interview_active": True, "question_index": 2}


@requires_db
@pytest.mark.asyncio
async def test_cleanup_expired_sessions_removes_stale_rows(session_store):
    session_id, _ = await session_store.create_session(user_id="alice")

    # Age the row past the expiry window directly in the database.
    stale_cutoff = datetime.now(timezone.utc) - timedelta(seconds=SESSION_EXPIRY_SECONDS + 60)  # noqa: UP017
    async with session_store_module.async_session_factory() as session:
        await session.execute(
            update(SessionModel).where(SessionModel.id == session_id).values(last_active_at=stale_cutoff)
        )
        await session.commit()

    removed = await session_store.cleanup_expired_sessions()
    assert removed >= 1
    assert await session_store.get(session_id=session_id, user_id="alice") is None


@requires_db
@pytest.mark.asyncio
async def test_cleanup_expired_sessions_keeps_recent_rows(session_store):
    session_id, _ = await session_store.create_session(user_id="alice")

    removed = await session_store.cleanup_expired_sessions()
    assert removed == 0
    assert await session_store.get(session_id=session_id, user_id="alice") is not None
