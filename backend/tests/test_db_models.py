"""Integration tests for the SQLAlchemy models against a real PostgreSQL database.

These tests are skipped unless an explicit ``TEST_DATABASE_URL`` is set. Point it
at a *disposable* PostgreSQL instance, e.g.::

    TEST_DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/testdb \\
        uv run pytest backend/tests/test_db_models.py

The fixtures drop and recreate **all** tables on the target database, so an
explicit test-only URL is required on purpose — never reuse a database that has
data you care about.
"""

import os
from datetime import date

import pytest
import pytest_asyncio
from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.db.models import (
    AwardModel,
    Base,
    CertificationModel,
    EducationModel,
    ExperienceModel,
    ProjectModel,
    ResumeModel,
    SessionModel,
    UserModel,
)

# Deliberately NOT falling back to DATABASE_URL: these tests drop/recreate every
# table, so they must only ever run against an explicitly designated test database.
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL/DATABASE_URL not set; requires a real PostgreSQL instance",
)


@pytest_asyncio.fixture
async def db_engine():
    """Create all tables, then drop them afterwards.

    Function-scoped so the engine's connection pool never crosses pytest's
    per-test event loops (asyncpg connections are loop-bound).
    """
    assert TEST_DATABASE_URL  # guarded by the module-level skipif; narrows the type for mypy
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Yield a fresh session per test."""
    factory = async_sessionmaker(db_engine, expire_on_commit=False)
    async with factory() as session:
        yield session


@pytest.mark.asyncio
async def test_create_all_creates_expected_tables(db_engine):
    async with db_engine.begin() as conn:
        tables = await conn.run_sync(lambda c: inspect(c).get_table_names())

    assert {
        "resumes",
        "experiences",
        "educations",
        "projects",
        "certifications",
        "awards",
        "sessions",
        "users",
        "saved_resumes",
    } <= set(tables)


@pytest.mark.asyncio
async def test_resume_round_trip_with_all_relationships(db_session):
    resume = ResumeModel(
        id="resume-roundtrip-1",
        skills=["Python", "SQL", "Docker"],
        experiences=[
            ExperienceModel(
                id=1,
                title="Software Engineer",
                company="ACME",
                start_date=date(2021, 1, 1),
                end_date=date(2023, 6, 30),
                description="Built and shipped REST APIs.",
            )
        ],
        educations=[
            EducationModel(id=1, school="State University", degree="BS Computer Science", gpa=3.8, gpa_max=4.0)
        ],
        projects=[
            ProjectModel(
                id=1,
                title="InterviewReady",
                description="AI interview coach",
                technologies=["FastAPI", "React"],
                url="https://example.com",
            )
        ],
        certifications=[CertificationModel(id=1, name="AWS Certified Developer", issuer="Amazon")],
        awards=[AwardModel(id=1, title="Employee of the Year", issuer="ACME")],
    )
    db_session.add(resume)
    await db_session.commit()

    result = await db_session.execute(
        select(ResumeModel)
        .where(ResumeModel.id == "resume-roundtrip-1")
        .options(
            selectinload(ResumeModel.experiences),
            selectinload(ResumeModel.educations),
            selectinload(ResumeModel.projects),
            selectinload(ResumeModel.certifications),
            selectinload(ResumeModel.awards),
        )
    )
    loaded = result.scalar_one()

    # ARRAY column round trip
    assert loaded.skills == ["Python", "SQL", "Docker"]

    # Child rows round trip through their FK relationships
    assert len(loaded.experiences) == 1
    experience = loaded.experiences[0]
    assert (
        experience.title,
        experience.company,
        experience.start_date,
        experience.end_date,
        experience.description,
    ) == ("Software Engineer", "ACME", date(2021, 1, 1), date(2023, 6, 30), "Built and shipped REST APIs.")

    assert loaded.educations[0].school == "State University"
    assert loaded.educations[0].gpa == 3.8
    assert loaded.projects[0].technologies == ["FastAPI", "React"]
    assert loaded.projects[0].url == "https://example.com"
    assert loaded.certifications[0].name == "AWS Certified Developer"
    assert loaded.awards[0].title == "Employee of the Year"


@pytest.mark.asyncio
async def test_cascade_delete_removes_child_rows(db_session):
    resume = ResumeModel(
        id="resume-cascade-1",
        skills=["Python"],
        experiences=[ExperienceModel(id=2, title="Intern", company="Startup")],
    )
    db_session.add(resume)
    await db_session.commit()

    await db_session.delete(resume)
    await db_session.commit()

    result = await db_session.execute(select(ExperienceModel).where(ExperienceModel.id == 2))
    assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_session_model_round_trip(db_session):
    session_row = SessionModel(
        id="session-roundtrip-1",
        user_id="user-1",
        shared_memory={"interview_active": True, "question_index": 2},
        history=[{"agent_name": "InterviewCoachAgent", "content": {"question": "Tell me about X"}}],
        decision_trace=["Routed to InterviewCoachAgent"],
        resume_data='{"skills": ["Python"]}',
        job_description="Senior Software Engineer",
    )
    db_session.add(session_row)
    await db_session.commit()

    result = await db_session.execute(select(SessionModel).where(SessionModel.id == "session-roundtrip-1"))
    loaded = result.scalar_one()

    assert loaded.user_id == "user-1"
    assert loaded.shared_memory == {"interview_active": True, "question_index": 2}
    assert loaded.history == [{"agent_name": "InterviewCoachAgent", "content": {"question": "Tell me about X"}}]
    assert loaded.decision_trace == ["Routed to InterviewCoachAgent"]
    assert loaded.job_description == "Senior Software Engineer"
    assert loaded.created_at is not None
    assert loaded.last_active_at is not None


@pytest.mark.asyncio
async def test_user_model_round_trip(db_session):
    db_session.add(UserModel(username="alice"))
    await db_session.commit()

    result = await db_session.execute(select(UserModel).where(UserModel.username == "alice"))
    loaded = result.scalar_one()

    assert loaded.username == "alice"
    assert loaded.created_at is not None
