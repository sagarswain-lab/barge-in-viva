const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function handle(res) {
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore parse errors, use status code */
    }
    throw new Error(`API error (${detail}). Is the backend running at ${API_URL}?`);
  }
  return res.json();
}

/** Start a new viva session. Returns { token, url, identity, room, session_id }. */
export async function createSession() {
  const res = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return handle(res);
}

/** List past sessions, most recent first. */
export async function listSessions() {
  const res = await fetch(`${API_URL}/sessions`);
  return handle(res);
}

/** Get one session's full transcript. */
export async function getSession(sessionId) {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`);
  return handle(res);
}
