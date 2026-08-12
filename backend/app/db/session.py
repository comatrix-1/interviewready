"""SQLAlchemy async engine, session factory, and FastAPI dependency.

The database layer is only activated when ``DATABASE_URL`` is configured.
Without it the application runs fully database-free (local dev, tests).
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.db.models import Base

if settings.DATABASE_URL:
    engine: AsyncEngine | None = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
    async_session_factory: async_sessionmaker[AsyncSession] | None = async_sessionmaker(
        engine, expire_on_commit=False
    )
else:
    engine = None
    async_session_factory = None


async def init_db() -> None:
    """Create all tables on startup. No-op when the database is disabled."""
    if engine is None:
        return
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def dispose_db() -> None:
    """Dispose the engine's connection pool on shutdown. No-op when disabled."""
    if engine is not None:
        await engine.dispose()


async def get_db() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency yielding a database session (commits on success)."""
    if async_session_factory is None:
        msg = "DATABASE_URL is not configured; database is disabled."
        raise RuntimeError(msg)
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
