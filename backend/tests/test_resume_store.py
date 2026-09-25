"""Integration tests for the saved-resume store against a real PostgreSQL database.

These tests are skipped unless an explicit ``TEST_DATABASE_URL`` is set, mirroring
``tests/test_db_models.py``. The fixtures drop and recreate **all** tables on the
target database, so it must be a disposable test-only database — never reuse a
database that has data you care about.
"""

import os

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import app.db.resume_store as resume_store_module
from app.db.models import Base
from app.db.resume_store import DatabaseResumeStore, ResumePersistenceUnavailableError
from app.models import Award, Certificate, Education, Project, Resume, Skill, Work

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL/DATABASE_URL not set; requires a real PostgreSQL instance",
)


@pytest_asyncio.fixture
async def resume_store():
    """Yield a DatabaseResumeStore bound to a fresh disposable test database."""
    assert TEST_DATABASE_URL  # guarded by the module-level skipif; narrows the type for mypy
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield DatabaseResumeStore(factory)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


def _full_resume() -> Resume:
    """A Resume exercising every JSON Resume section for round-trip coverage."""
    return Resume(
        work=[Work(name="ACME", position="Engineer", startDate="2021-01", highlights=["Built REST APIs"])],
        education=[Education(institution="State University", area="CS", studyType="BS", courses=["Algorithms"])],
        awards=[Award(title="Engineer of the Year", awarder="ACME")],
        certificates=[Certificate(name="AWS Certified Developer", issuer="Amazon")],
        skills=[Skill(name="Python"), Skill(name="PostgreSQL")],
        projects=[Project(name="InterviewReady", description="AI interview coach", url="https://example.com")],
    )


@pytest.mark.asyncio
async def test_list_for_user_returns_only_own_records_newest_first(resume_store):
    first = _full_resume()
    second = Resume(
        work=[Work(name="Beta Corp", position="Lead", startDate="2023-06")],
        skills=[Skill(name="Go"), Skill(name="Kubernetes")],
    )
    bob_resume = Resume(skills=[Skill(name="SQL")])

    await resume_store.create(user_id="alice", filename="first.pdf", resume=first)
    await resume_store.create(user_id="bob", filename="bob.pdf", resume=bob_resume)
    await resume_store.create(user_id="alice", filename="second.pdf", resume=second)

    records = await resume_store.list_for_user(user_id="alice")

    assert [item.filename for item in records] == ["second.pdf", "first.pdf"]
    assert [item.resume for item in records] == [second, first]


@pytest.mark.asyncio
async def test_list_for_user_returns_empty_list_for_unknown_user(resume_store):
    records = await resume_store.list_for_user(user_id="nobody")

    assert records == []


@pytest.mark.asyncio
async def test_create_round_trips_all_json_resume_fields(resume_store):
    resume = _full_resume()

    record = await resume_store.create(user_id="alice", filename="full.pdf", resume=resume)

    assert record.id
    assert record.filename == "full.pdf"
    assert record.created_at is not None
    assert record.resume == resume


def test_build_resume_store_raises_without_database(monkeypatch):
    monkeypatch.setattr(resume_store_module, "async_session_factory", None)

    with pytest.raises(ResumePersistenceUnavailableError):
        resume_store_module.build_resume_store()
