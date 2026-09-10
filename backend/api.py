"""
backend/api.py

Backend API for the frontend:
  POST /sessions        — start a new viva session (mints a token, creates a
                           UNIQUE room so LiveKit's automatic dispatch fires
                           reliably every time — see agent.py's entrypoint
                           docstring for why a shared static room name was
                           the likely cause of "empty room, no examiner")
  GET  /sessions         — list past sessions for the History view
  GET  /sessions/{id}    — full transcript for one past session
  GET  /health           — liveness check

Run from inside backend/:
    uvicorn api:app --reload --port 8000
(On Windows, prefer `python -m uvicorn api:app --reload --port 8000` — a
bare `uvicorn` on PATH can resolve to an unrelated virtual environment.)

The agent worker (src/agent.py) and this API are two independent processes
that share one SQLite file (src/storage.py) for session history.
"""

import os
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from livekit import api as lk_api
from pydantic import BaseModel

load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))
import storage  # noqa: E402

LIVEKIT_API_KEY = os.environ.get("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.environ.get("LIVEKIT_API_SECRET", "")
LIVEKIT_URL = os.environ.get("LIVEKIT_URL", "")

# Comma-separated list of allowed frontend origins for production. Falls
# back to "*" for local development. Set FRONTEND_ORIGIN in your .env (or
# Render's dashboard) once you have a real Vercel URL, e.g.:
#   FRONTEND_ORIGIN=https://barge-in-viva.vercel.app
_origins_env = os.environ.get("FRONTEND_ORIGIN", "*")
ALLOWED_ORIGINS = ["*"] if _origins_env == "*" else [o.strip() for o in _origins_env.split(",")]

app = FastAPI(title="Barge-In Viva API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NewSessionRequest(BaseModel):
    identity: Optional[str] = None


@app.post("/sessions")
def create_session(req: NewSessionRequest):
    if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not LIVEKIT_URL:
        raise HTTPException(500, "Server is missing LiveKit credentials in .env")

    session_id = storage.new_session_id()
    room = f"viva-{session_id}"
    identity = req.identity or f"student-{session_id[:8]}"

    token = (
        lk_api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(identity)
        .with_grants(
            lk_api.VideoGrants(room_join=True, room=room, can_publish=True, can_subscribe=True)
        )
        .to_jwt()
    )

    # The DB row is created here as a placeholder; agent.py overwrites/
    # confirms it with the real topic once it picks one. This means a
    # session shows up in history immediately, even before the agent
    # finishes joining — useful for spotting dispatch failures, since a
    # session stuck at topic=None for a while is a visible symptom.
    storage.create_session(session_id, room=room, topic=None)

    return {
        "token": token,
        "url": LIVEKIT_URL,
        "identity": identity,
        "room": room,
        "session_id": session_id,
    }


@app.get("/sessions")
def list_sessions(limit: int = 50):
    return storage.list_sessions(limit=limit)


@app.get("/sessions/{session_id}")
def get_session(session_id: str):
    session = storage.get_session(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@app.get("/health")
def health():
    return {"status": "ok"}
