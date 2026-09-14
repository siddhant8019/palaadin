"""Postgres access. Plain SQL through psycopg 3. Works against local Postgres or Supabase."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def connect(database_url: str) -> psycopg.Connection:
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(database_url, autocommit=True, row_factory=dict_row)


@contextmanager
def conn_ctx(database_url: str):
    conn = connect(database_url)
    try:
        yield conn
    finally:
        conn.close()


def migrate(database_url: str) -> list[str]:
    applied: list[str] = []
    with conn_ctx(database_url) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        done = {r["version"] for r in conn.execute("SELECT version FROM schema_migrations").fetchall()}
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.stem in done:
                continue
            with conn.transaction():
                conn.execute(path.read_text())
                conn.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (path.stem,))
            applied.append(path.stem)
    # LangGraph checkpoint tables live in the same database.
    from langgraph.checkpoint.postgres import PostgresSaver

    with conn_ctx(database_url) as conn:
        PostgresSaver(conn).setup()
    return applied
