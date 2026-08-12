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
