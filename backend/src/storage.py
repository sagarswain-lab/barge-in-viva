"""
backend/src/storage.py

Session-history store shared by agent.py (writes) and api.py (reads).

IMPORTANT DEPLOYMENT NOTE: the agent worker and the API run as two
SEPARATE services on Render (a background worker and a web service) —
they do NOT share a filesystem, even within the same project. A plain
SQLite file only works when both processes run locally on one machine.
For a real deployed instance where history must be visible across both
services, set DATABASE_URL to a Postgres connection string (Render's free
Postgres add-on provides this automatically via the render.yaml blueprint
in this repo). If DATABASE_URL is unset, this falls back to a local
SQLite file for simple local development.
"""

import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_POSTGRES = DATABASE_URL.startswith(("postgres://", "postgresql://"))

if IS_POSTGRES:
    import psycopg
    from psycopg.rows import dict_row
else:
    _raw_path = os.environ.get("DATABASE_PATH", "").strip()
    if _raw_path:
        _p = Path(_raw_path)
        SQLITE_PATH = _p if _p.is_absolute() else (Path(__file__).resolve().parent.parent / _p).resolve()
    else:
        SQLITE_PATH = Path(__file__).resolve().parent.parent / "sessions.db"


@contextmanager
def _conn():
    if IS_POSTGRES:
        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=False)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(SQLITE_PATH)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def _ph(n: int) -> str:
    """Placeholder style differs: Postgres uses %s, SQLite uses ?."""
    style = "%s" if IS_POSTGRES else "?"
    return ", ".join([style] * n)


def init_db():
    id_type = "SERIAL PRIMARY KEY" if IS_POSTGRES else "INTEGER PRIMARY KEY AUTOINCREMENT"
    schema = f"""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        room TEXT NOT NULL,
        topic TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        started_at DOUBLE PRECISION NOT NULL,
        ended_at DOUBLE PRECISION
    );
    CREATE TABLE IF NOT EXISTS transcript_lines (
        id {id_type},
        session_id TEXT NOT NULL,
        speaker TEXT NOT NULL,
        text TEXT NOT NULL,
        ts DOUBLE PRECISION NOT NULL
    );
    """
    with _conn() as conn:
        if IS_POSTGRES:
            with conn.cursor() as cur:
                cur.execute(schema)
        else:
            conn.executescript(schema.replace("DOUBLE PRECISION", "REAL"))


def new_session_id() -> str:
    return uuid.uuid4().hex[:12]


def create_session(session_id: str, room: str, topic: str | None = None):
    q = f"INSERT INTO sessions (id, room, topic, status, started_at) VALUES ({_ph(5)})"
    with _conn() as conn:
        _execute(conn, q, (session_id, room, topic, "active", time.time()))


def ensure_topic(session_id: str, room: str, topic: str):
    """
    Upsert used by agent.py. api.py already inserts a placeholder session
    row (topic=None) the moment a token is minted — calling create_session()
    again here with the real topic would hit a duplicate-primary-key error
    on session_id, since it's already the row's TEXT PRIMARY KEY. That
    exception was going unhandled inside the agent's entrypoint, which is
    almost certainly why the app was misbehaving: a crashed entrypoint can
    get retried/respawned by LiveKit, leaving more than one agent instance
    alive in the same room and talking over each other — matching symptoms
    like "won't stop talking" and "talks before I said anything." This
    upsert fixes the root cause instead of only silencing the symptom.
    """
    if IS_POSTGRES:
        q = (
            f"INSERT INTO sessions (id, room, topic, status, started_at) "
            f"VALUES ({_ph(5)}) "
            f"ON CONFLICT (id) DO UPDATE SET topic = EXCLUDED.topic"
        )
    else:
        q = (
            f"INSERT INTO sessions (id, room, topic, status, started_at) "
            f"VALUES ({_ph(5)}) "
            f"ON CONFLICT(id) DO UPDATE SET topic = excluded.topic"
        )
    with _conn() as conn:
        _execute(conn, q, (session_id, room, topic, "active", time.time()))


def set_session_topic(session_id: str, topic: str):
    with _conn() as conn:
        _execute(conn, f"UPDATE sessions SET topic = {_ph(1)} WHERE id = {_ph(1)}", (topic, session_id))


def end_session(session_id: str):
    with _conn() as conn:
        _execute(
            conn,
            f"UPDATE sessions SET status = 'ended', ended_at = {_ph(1)} WHERE id = {_ph(1)}",
            (time.time(), session_id),
        )


def append_transcript_line(session_id: str, speaker: str, text: str):
    with _conn() as conn:
        _execute(
            conn,
            f"INSERT INTO transcript_lines (session_id, speaker, text, ts) VALUES ({_ph(4)})",
            (session_id, speaker, text, time.time()),
        )


def list_sessions(limit: int = 50) -> list[dict]:
    with _conn() as conn:
        rows = _fetchall(
            conn,
            f"SELECT id, room, topic, status, started_at, ended_at FROM sessions "
            f"ORDER BY started_at DESC LIMIT {_ph(1)}",
            (limit,),
        )
        return [dict(r) for r in rows]


def get_session(session_id: str) -> dict | None:
    with _conn() as conn:
        row = _fetchone(
            conn,
            f"SELECT id, room, topic, status, started_at, ended_at FROM sessions WHERE id = {_ph(1)}",
            (session_id,),
        )
        if not row:
            return None
        session = dict(row)
        lines = _fetchall(
            conn,
            f"SELECT speaker, text, ts FROM transcript_lines WHERE session_id = {_ph(1)} ORDER BY ts ASC",
            (session_id,),
        )
        session["transcript"] = [dict(l) for l in lines]
        return session


# --- tiny dialect-agnostic execute/fetch helpers ----------------------------
def _execute(conn, query: str, params: tuple):
    if IS_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(query, params)
    else:
        conn.execute(query, params)


def _fetchall(conn, query: str, params: tuple):
    if IS_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchall()
    else:
        return conn.execute(query, params).fetchall()


def _fetchone(conn, query: str, params: tuple):
    if IS_POSTGRES:
        with conn.cursor() as cur:
            cur.execute(query, params)
            return cur.fetchone()
    else:
        return conn.execute(query, params).fetchone()


init_db()
