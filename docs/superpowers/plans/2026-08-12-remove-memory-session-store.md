# Remove MemorySessionStore (PostgreSQL-only Sessions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `MemorySessionStore` so session storage is PostgreSQL-only, and make the app fail fast at startup when `DATABASE_URL` is not configured.

**Architecture:** `backend/app/db/session_store.py` keeps the `SessionStore` ABC and `DatabaseSessionStore`; the `MemorySessionStore` class and its helpers are deleted. `build_session_store()` raises `RuntimeError` when the DB layer is unavailable (`async_session_factory is None`). Because `app/api/v1/services.py` builds the store eagerly at import (`_session_store = build_session_store()`), importing the API — and therefore starting the app — fails fast with a clear message when `DATABASE_URL` is missing. No endpoint, service, or `DatabaseSessionStore` behavior changes.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, asyncpg, pytest, pytest-asyncio, ruff, import-linter.

## Global Constraints

- `DATABASE_URL` is **required**. Without it the app fails to start; there is **no in-memory fallback for sessions**, ever.
- `DatabaseSessionStore` behavior is unchanged — it is already the production path (the developer `.env` has a real `DATABASE_URL`).
- `MemoryUserStore` (in `app/db/user_store.py`) is **out of scope** — only `MemorySessionStore` is removed. Do not touch it.
- `app/db/resume_store.py` (lazy `ResumePersistenceUnavailableError` → 503) is **out of scope** — do not touch it.
- Follow the established PostgreSQL-only precedent from `app/db/resume_store.py` for error style.
- Layer discipline: `api` may reach `db` only through the `app/api/v1/services.py` facade (import-linter contract in `backend/.importlinter`). This change does not alter any import edges.
- After every task, run `npm run lint:all` (pre-commit runs it too). Ruff auto-fix will catch any unused imports left by the deletion.
- Integration tests run against a **disposable** database via `TEST_DATABASE_URL` (fixture pattern from `backend/tests/test_resume_store.py`); skipped without it. Existing `test_api_endpoints.py` session tests need a reachable Postgres (they already hit the real `sessions` table today) — start one with `docker compose up -d postgres` and point `backend/.env`'s `DATABASE_URL` at it.
- Run backend commands from `backend/` so `.env` is loaded, or export `DATABASE_URL` in the shell.

## File Structure

| File | Change |
|------|--------|
| `backend/app/db/session_store.py` | Delete `MemorySessionStore` + its helpers; make `build_session_store()` fail fast; update module docstring; drop now-unused imports (`time`, `threading.RLock`). |
| `backend/tests/test_session_store.py` | **Create.** Unit test for the fail-fast `build_session_store()` + integration tests for `DatabaseSessionStore` (disposable `TEST_DATABASE_URL`). |
| `backend/README.md` | `DATABASE_URL` becomes required; Session Management section is PostgreSQL-only; fix the stale users-storage sentence. |
| `backend/.env.example` | Add required `DATABASE_URL`. |

No changes needed in `app/api/v1/services.py`, any endpoint, `app/db/session.py`, `app/db/models.py`, or the frontend.

---

### Task 1: Delete `MemorySessionStore` and make `build_session_store()` fail fast

**Files:**
- Modify: `backend/app/db/session_store.py`
- Create: `backend/tests/test_session_store.py` (unit test only for now)

**Interfaces:**
- Consumes: `app.db.session.async_session_factory` (module global, unchanged).
- Produces: `build_session_store() -> SessionStore` that raises `RuntimeError` when `async_session_factory is None`, else returns `DatabaseSessionStore()`. `SessionStore` ABC and `DatabaseSessionStore` keep their exact signatures. Later tasks use `DatabaseSessionStore`, `SESSION_EXPIRY_SECONDS`, and the `async_session_factory` module global.

- [ ] **Step 1: Write the failing unit test**

Create `backend/tests/test_session_store.py` (only the imports the unit test needs for now; Task 2 adds the rest):

```python
"""Tests for the PostgreSQL-only session store.

``test_build_session_store_raises_without_database`` is a pure unit test (no DB
needed). The ``DatabaseSessionStore`` integration tests below are skipped unless
``TEST_DATABASE_URL`` is set, mirroring ``tests/test_resume_store.py``.
"""

import pytest

import app.db.session_store as session_store_module
from app.db.session_store import build_session_store


def test_build_session_store_raises_without_database(monkeypatch):
    monkeypatch.setattr(session_store_module, "async_session_factory", None)

    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        build_session_store()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && uv run pytest tests/test_session_store.py::test_build_session_store_raises_without_database -v`
Expected: FAIL — today `build_session_store()` returns a `MemorySessionStore` instead of raising.

- [ ] **Step 3: Delete `MemorySessionStore` and implement fail-fast**

In `backend/app/db/session_store.py`:

1. Update the module docstring:

```python
"""Session storage backend for API endpoints.

PostgreSQL-only: :class:`DatabaseSessionStore` persists user-owned session
contexts via :class:`app.db.session`. There is deliberately no in-memory
fallback — sessions require ``DATABASE_URL`` and the app fails fast at startup
when it is not configured.
"""
```

2. Delete the entire `MemorySessionStore` class (its `_generate_session_id`, `_remove_session_id`, `create_session`, `cleanup_expired_sessions`, `get_or_create`, `get`, `save` methods) and its now-dead helpers.

3. Remove the imports only that class used:

```python
import time
from threading import RLock
```

Keep `contextlib`, `uuid`, `datetime`/`timedelta`/`timezone`, `delete`/`update`, `IntegrityError`, `logger`, `SessionModel`, `async_session_factory`, `AgentResponse`, `SessionContext`.

4. Replace `build_session_store()`:

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && uv run pytest tests/test_session_store.py::test_build_session_store_raises_without_database -v`
Expected: PASS.

- [ ] **Step 5: Sanity-check the existing suite and lint**

Run: `cd backend && uv run pytest tests/test_api_endpoints.py -v`
Expected: PASS (these tests already use `DatabaseSessionStore` in this environment; requires Postgres up — see Global Constraints).

Run: `npm run lint:all`
Expected: clean; Ruff flags nothing new.

- [ ] **Step 6: Commit**

```bash
git add backend/app/db/session_store.py backend/tests/test_session_store.py
git commit -m "feat: make sessions PostgreSQL-only, fail fast without DATABASE_URL"
```

---

### Task 2: Add `DatabaseSessionStore` integration tests

**Files:**
- Modify: `backend/tests/test_session_store.py`

**Interfaces:**
- Consumes: `DatabaseSessionStore` (all five `SessionStore` methods unchanged), `SESSION_EXPIRY_SECONDS`, and the `async_session_factory` module global (monkeypatched onto the disposable test engine — `DatabaseSessionStore` reads it from module scope at call time).
- Produces: a reusable `session_store` fixture other test files can copy.

- [ ] **Step 1: Write the failing integration tests**

First replace the imports block at the top of `backend/tests/test_session_store.py` with the full set the integration tests need:

```python
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
```

Then add the fixture and tests to the file:

```python
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
    stale_cutoff = datetime.now(timezone.utc) - timedelta(seconds=SESSION_EXPIRY_SECONDS + 60)
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
```

- [ ] **Step 2: Run the tests against a disposable database**

Run (point `TEST_DATABASE_URL` at a fresh disposable database):
`cd backend && TEST_DATABASE_URL=postgresql+asyncpg://interviewready:interviewready@localhost:5432/testdb uv run pytest tests/test_session_store.py -v`

Expected: PASS (unit test always runs; integration tests now exercise the store). Without `TEST_DATABASE_URL`, the integration tests skip and only the unit test runs.

- [ ] **Step 3: Lint and commit**

Run: `npm run lint:all`
Expected: clean.

```bash
git add backend/tests/test_session_store.py
git commit -m "test: add DatabaseSessionStore integration tests against disposable postgres"
```

---

### Task 3: Update documentation

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: nothing from code.
- Produces: docs reflecting that `DATABASE_URL` is required and sessions are PostgreSQL-only.

- [ ] **Step 1: Update the config section in `backend/README.md`**

Replace:

```markdown
# Database (Optional — enables SQLAlchemy async persistence; unset = DB-free)
DATABASE_URL=postgresql+asyncpg://interviewready:interviewready@localhost:5432/interviewready

> When `DATABASE_URL` is set, the app creates tables on startup and fails fast if the
> database is unreachable. Without it, the app runs database-free.
```

with:

```markdown
# Database (Required — PostgreSQL is mandatory; no in-memory fallback)
DATABASE_URL=postgresql+asyncpg://interviewready:interviewready@localhost:5432/interviewready

> `DATABASE_URL` is required. The app creates tables on startup and fails fast if the
> database is unreachable or `DATABASE_URL` is missing.
```

- [ ] **Step 2: Update the Session Management section in `backend/README.md`**

Replace:

```markdown
Sessions are stored in PostgreSQL (via `app/db/session_store.py`) when `DATABASE_URL` is set, and fall back to an in-memory store otherwise. Context is hydrated from the database on each request and persisted after a successful chat orchestration (`save()`); the `sessions` table is swept of expired rows on session creation. Note: state from a *failed* chat request is not persisted (in-memory mode kept partial mutations).
```

with:

```markdown
Sessions are stored in PostgreSQL only (via `app/db/session_store.py`); there is no in-memory fallback, and `DATABASE_URL` is required to start the app. Context is hydrated from the database on each request and persisted after a successful chat orchestration (`save()`); the `sessions` table is swept of expired rows on session creation. State from a *failed* chat request is not persisted.
```

- [ ] **Step 3: Fix the stale users-storage sentence in `backend/README.md`**

In the `POST /api/v1/users/login` section, replace:

```markdown
Users are stored in PostgreSQL when
`DATABASE_URL` is set and in memory otherwise.
```

with:

```markdown
Users are stored in PostgreSQL (the `users` table).
```

- [ ] **Step 4: Add `DATABASE_URL` to `backend/.env.example`**

Append at the end of the file:

```bash
# Database (Required — PostgreSQL is mandatory; no in-memory fallback)
DATABASE_URL=postgresql+asyncpg://interviewready:interviewready@localhost:5432/interviewready
```

- [ ] **Step 5: Verify the docs have no stale in-memory claims**

Run: `grep -n "in-memory store otherwise\|runs database-free\|DB-free" backend/README.md`
Expected: no matches (remaining "in-memory" mentions in `backend/README.md` may exist only for user-store context — confirm each is accurate; `MemoryUserStore` itself is out of scope).

- [ ] **Step 6: Commit**

```bash
git add backend/README.md backend/.env.example
git commit -m "docs: document PostgreSQL-only sessions and required DATABASE_URL"
```

---

### Task 4: Make endpoint tests hermetic (stub session + user stores)

Added by user decision during execution: `tests/test_api_endpoints.py` had 4
pre-existing failures in this environment (asyncpg ``Event loop is closed``
crossing the TestClient loop; and ``created: False != True`` because the
`users` row persists in the real Postgres across runs — these tests were
written for the memory-store era's fresh per-run state). Decision: stub both
stores so endpoint tests are deterministic and DB-free, matching the existing
`_stub_resume_store` pattern.

**Files:**
- Modify: `backend/tests/test_api_endpoints.py`

**Interfaces:**
- Consumes: `SessionStore` method shapes (`create_session`, `get_or_create`,
  `get`, `save`, `cleanup_expired_sessions`); `UserStore.get_or_create`; the
  endpoint-module accessor import paths `app.api.v1.endpoints.chat`,
  `app.api.v1.endpoints.sessions`, `app.api.v1.endpoints.users`.
- Produces: `FakeSessionStore` / `FakeUserStore` classes and an autouse
  `_stub_stores` fixture that make endpoint tests independent of Postgres.

- [ ] **Step 1: Add the fake stores and autouse fixture**

In `backend/tests/test_api_endpoints.py`, add `import pytest` and
`SessionContext` to the `app.models` import, then insert:

```python
class FakeSessionStore:
    """In-memory SessionStore stub with DatabaseSessionStore ownership semantics."""

    def __init__(self) -> None:
        self._sessions: dict[tuple[str, str], SessionContext] = {}

    async def create_session(self, user_id: str) -> tuple[str, SessionContext]:
        session_id = f"session_{len(self._sessions) + 1}"
        context = SessionContext(session_id=session_id, user_id=user_id)
        self._sessions[(session_id, user_id)] = context
        return session_id, context

    async def get_or_create(self, session_id: str, user_id: str) -> SessionContext:
        existing = self._sessions.get((session_id, user_id))
        if existing is not None:
            return existing
        if any(sid == session_id for (sid, _uid) in self._sessions):
            msg = "Unauthorized access to session"
            raise PermissionError(msg)
        context = SessionContext(session_id=session_id, user_id=user_id)
        self._sessions[(session_id, user_id)] = context
        return context

    async def get(self, session_id: str, user_id: str) -> SessionContext | None:
        context = self._sessions.get((session_id, user_id))
        if context is not None:
            return context
        if any(sid == session_id for (sid, _uid) in self._sessions):
            msg = "Unauthorized access to session"
            raise PermissionError(msg)
        return None

    async def save(self, context: SessionContext) -> None:
        if context.session_id is not None:
            self._sessions[(context.session_id, context.user_id)] = context

    async def cleanup_expired_sessions(self) -> int:
        return 0


class FakeUserStore:
    """In-memory UserStore stub: fresh registration state per test."""

    def __init__(self) -> None:
        self._usernames: set[str] = set()

    async def get_or_create(self, username: str) -> bool:
        if username in self._usernames:
            return False
        self._usernames.add(username)
        return True


@pytest.fixture(autouse=True)
def _stub_stores(monkeypatch):
    """Hermetic endpoint tests: stub session/user stores, never touch Postgres."""
    fake_sessions = FakeSessionStore()
    fake_users = FakeUserStore()
    monkeypatch.setattr("app.api.v1.endpoints.chat.get_session_store", lambda: fake_sessions)
    monkeypatch.setattr("app.api.v1.endpoints.chat.get_or_create_session_context", fake_sessions.get_or_create)
    monkeypatch.setattr("app.api.v1.endpoints.sessions.get_session_store", lambda: fake_sessions)
    monkeypatch.setattr("app.api.v1.endpoints.sessions.get_session_context", fake_sessions.get)
    monkeypatch.setattr("app.api.v1.endpoints.users.get_user_store", lambda: fake_users)
```

- [ ] **Step 2: Run the endpoint tests to verify they pass without a live DB**

Run: `cd backend && uv run pytest tests/test_api_endpoints.py -v`
Expected: ALL PASS (previously 4 failed with asyncpg ``Event loop is closed``
and the fresh-state assertion). No DB needed.

- [ ] **Step 3: Lint and commit**

Run: `npm run lint:all` — expected clean.

```bash
git add backend/tests/test_api_endpoints.py
git commit -m "test: stub session and user stores in endpoint tests for hermetic runs"
```

---

### Task 5: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the linter**

Run from repo root: `npm run lint:all`
Expected: clean (ESLint, Ruff, import-linter).

- [ ] **Step 2: Run the full backend suite**

Run: `cd backend && uv run pytest -v`
Expected: PASS. Integration suites (`test_db_models.py`, `test_resume_store.py`, `test_session_store.py`) need `TEST_DATABASE_URL`; all endpoint tests need a reachable Postgres (see Global Constraints).

- [ ] **Step 3: Manual fail-fast check**

Run: `cd backend && DATABASE_URL= uv run python -c "import app.main"`
Expected: exits with `RuntimeError: Sessions require DATABASE_URL to be configured: PostgreSQL is mandatory, there is no in-memory fallback.` — the app refuses to start without a database.

Run: `cd backend && uv run python -c "import app.main"`
Expected: starts cleanly (no error) with the real `DATABASE_URL`.

- [ ] **Step 4: Confirm no `MemorySessionStore` references remain**

Run: `grep -rn "MemorySessionStore" backend/ docs/superpowers/plans/`
Expected: matches only in this plan document and the pre-change git history — none in live code.

- [ ] **Step 5: Final review**

Run a `requesting-code-review` pass over the diff (or hand off to a reviewer): confirm the deletion removed only memory-store code, `DatabaseSessionStore` is byte-for-byte behavior-equivalent, and no endpoint/service signatures changed.

## Self-Review

1. **Spec coverage:** The user asked to remove `MemorySessionStore` and make the backend PostgreSQL-only (fail-fast chosen via clarification). Task 1 removes the class and enforces fail-fast; Task 2 preserves session-store test coverage (previously only the memory implementation was unit-testable); Task 3 removes stale docs; Task 4 verifies everything including the startup failure. ✔
2. **Placeholder scan:** Every step contains concrete code or commands; no TBDs. ✔
3. **Type consistency:** `build_session_store()` keeps its `-> SessionStore` return type; `SessionStore` ABC methods are unchanged; `SESSION_EXPIRY_SECONDS` and `async_session_factory` are referenced under the same names Task 2 uses. `DatabaseSessionStore` is never constructed with arguments (it reads the module global), which is why the Task 2 fixture monkeypatches `session_store_module.async_session_factory`. ✔
4. **Deferred/out-of-scope, noted deliberately:** `MemoryUserStore` and the resume store's lazy-503 behavior remain untouched.
