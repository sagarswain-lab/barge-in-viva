# Barge-In Viva

A voice-native oral-exam practice partner. It trains the skill a text quiz
can't: staying composed while an examiner interrupts, redirects, or presses
a follow-up mid-answer. Rime provides the primary spoken output — removing
speech would remove the entire mechanic, not just a nice-to-have layer.

## Demo
**[Watch the demo video](https://youtu.be/2GsayNyvld4?si=1WHNpiuCv8w-Rw-E)** (4-5 min)

## Problem & user
Viva voce exams, thesis defenses, and technical interviews all share one
skill that has nothing to do with subject knowledge: staying composed while
an examiner interrupts mid-answer, redirects the question, or presses a
follow-up before you've finished a thought. Text-based prep tools (quizzes,
flashcards, chatbot Q&A) cannot train this — there is no meaningful way to
"interrupt" someone typing. The skill only exists in spoken, real-time
exchange, which makes voice the substrate of the problem itself.

## Hard voice problem
Interruption and recovery (barge-in handling). Full claim, acceptance test,
and results are in `RIME_EVIDENCE.md`.

## Repository structure
```
barge-in-viva/
├── README.md                     ← you are here
├── RIME_EVIDENCE.md               ← the hard-voice claim, test, and results
├── DEPLOY.md                      ← detailed Render + Vercel deployment steps
├── docs/
│   ├── EXECUTION_RUNBOOK.md        ← day-by-day build checklist
├── backend/
│   ├── src/
│   │   ├── agent.py                 ← the voice agent (STT/LLM/TTS/interrupts)
│   │   └── storage.py               ← session history (Postgres in prod, SQLite locally)
│   ├── api.py                       ← FastAPI: session creation + history endpoints
│   ├── tests/test_interrupt.py      ← automated acceptance-test harness
│   ├── fixtures/
│   ├── requirements.txt
│   ├── render.yaml                  ← Render deployment blueprint
│   └── .env.example
└── frontend/                      ← React + Vite, Tailwind CSS + Framer Motion
    ├── src/
    │   ├── pages/
    │   │   ├── Landing.jsx           ← entrance, mic preflight check, "Begin viva"
    │   │   ├── LiveSession.jsx        ← the live LiveKitRoom session
    │   │   ├── SessionHistoryList.jsx ← past sessions
    │   │   └── SessionDetail.jsx      ← replay a past transcript
    │   ├── components/
    │   │   ├── ExaminationChamber.jsx
    │   │   ├── AudioBars.jsx           ← animated voice-state bars, flashes on interrupt
    │   │   ├── SessionHeader.jsx
    │   │   ├── TranscriptLog.jsx
    │   │   ├── ControlBar.jsx
    │   │   └── MicTroubleshootPanel.jsx
    │   └── lib/
    │       ├── api.js                ← backend client
    │       └── micCheck.js           ← microphone preflight check
    ├── vercel.json                  ← SPA routing for Vercel
    ├── package.json
    └── .env.example
```

## Architecture
- **Transport/orchestration:** LiveKit Agents
- **STT:** Groq Whisper (large-v3-turbo)
- **LLM:** Groq, model configurable via `GROQ_LLM_MODEL` in `.env`
  (default `openai/gpt-oss-120b` — Groq's own recommended replacement for
  `llama-3.3-70b-versatile`, which was decommissioned 2026-08-16).
  Deliberately not using `groq/compound`: it's real and valid, but it's an
  agentic system that can autonomously trigger web search/code execution,
  risking latency spikes that fight this project's whole thesis.
- **TTS:** Rime, model `coda`, speaker `bancroft` (composed, formal-register
  voice — chosen for examiner tone), language `en`, WebSocket streaming
  (auto-enables word-level timestamps), audio format `pcm` (the plugin's
  default; LiveKit's own transport handles Opus/WebRTC encoding
  separately), default endpoint is US West — test US East too and use
  whichever measures lower latency from your location; neither is close
  to India, so measure rather than assume.
- **VAD:** Silero (local, via LiveKit's silero plugin)
- **Frontend:** React + Vite. Tailwind CSS v4 for styling (near-black
  surface, cyan accent, matching the LiveKit Playground's visual
  language). `livekit-client` + `@livekit/components-react` for room
  connection, realtime transcription, and agent-state hooks. Framer
  Motion for cinematic entrance/transition/interrupt animations.
  `react-router-dom` for real, deep-linkable routes (`/`, `/session`,
  `/history`, `/history/:id`).
- **Exam content:** dynamic, not a fixed question bank. The examiner asks
  the candidate what field they'd like to be examined on (any subject —
  law, agriculture, chemistry, anything) and generates real, field-
  appropriate questions and follow-ups itself, rather than being limited
  to a hardcoded topic list. The candidate's own answer becomes the
  session's topic label in history.
- **Session identity:** each "Begin viva" click creates a **unique room**
  (`viva-{id}`), not a shared static room name. This matters: LiveKit's
  automatic agent dispatch fires on room *creation*, not on every
  participant join — reusing one static room name was the root cause of
  an earlier bug where the candidate joined an empty room with no
  examiner. Unique rooms per session fix this and double as the natural
  key for session history.
- **Session history:** every conversation turn is written to a shared
  database (`backend/src/storage.py`) via LiveKit's `conversation_item_added`
  event. In production this is Postgres (see Deployment below); locally,
  it falls back to a SQLite file automatically.
- **API (`backend/api.py`):** mints LiveKit tokens for the frontend and
  exposes session history. The frontend never holds LiveKit secrets.

Audio flow: browser mic → LiveKit → Groq STT → Groq LLM → Rime TTS →
LiveKit → browser speaker. The interrupt signal is LiveKit's own voice
activity detection (`allow_interruptions`), instrumented via the
`overlapping_speech` event and logged to `interrupt_events.jsonl` for the
acceptance test in `backend/tests/test_interrupt.py`.

## Local setup

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your own keys — never commit real ones

# Terminal 1: the voice agent worker
python src/agent.py dev

# Terminal 2: the API the frontend talks to
python -m uvicorn api:app --reload --port 8000
```
(Use `python -m uvicorn ...`, not a bare `uvicorn` command — on Windows
especially, a bare `uvicorn` on PATH can silently resolve to an unrelated
virtual environment, producing a confusing `ModuleNotFoundError`.)

No `DATABASE_URL` needed locally — `storage.py` falls back to a local
SQLite file (`backend/sessions.db`) automatically.

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # defaults to http://localhost:8000
npm run dev
```
Open the printed local URL. Click "Begin viva," allow microphone access,
and you should hear the examiner's first question.

All external services — LiveKit Cloud, Groq, and Rime — have free tiers
sufficient for this project. See `docs/EXECUTION_RUNBOOK.md` for account
setup details.

## Deployment

Optional polish, not required for the Sep 8 submission (a demo recording +
public repo satisfies the brief). Full step-by-step instructions —
including exact dashboard clicks, environment variable setup, CORS
configuration, and a troubleshooting section — are in **[DEPLOY.md](./DEPLOY.md)**.

Short version: backend deploys to Render via `backend/render.yaml`
(provisions the API, the agent worker, and a shared Postgres database in
one blueprint); frontend deploys to Vercel with root directory `frontend`
and one environment variable (`VITE_API_URL`) pointing at the Render API.

## Known limitations
- Rime's cloud endpoints are US-only (West/East) — no region near India. We
  measured and used whichever endpoint gave lower latency from our
  location; expect 150-250ms network overhead beyond Rime's own ~100ms
  model latency (see RIME_EVIDENCE.md for our actual measured numbers).
- Coda does not support per-word speed control (Mist-only) — a
  language-tutor-style "slow this word down" feature would require a
  model swap, not just a config change.
- The examiner's opening line is scripted (`session.say()`), not
  LLM-generated, by design — this guarantees it always asks the
  candidate's subject rather than occasionally announcing one itself
  (an LLM instruction-following issue we hit and fixed structurally).
  Every turn after that is fully live LLM generation.
- On Render's free tier, both services (API, agent worker) cold-start
  after ~15 minutes idle; first request after idle may take 30-60s.
- Session history requires Postgres in the deployed version (a shared
  SQLite file does not work across two separate Render services); local
  development falls back to SQLite automatically.

## What's live vs. precomputed
Everything in this build is live at demo time: real STT, real LLM
reasoning, real Rime synthesis, real interruption detection, real session
history. There is no precomputed or scripted response anywhere in the
pipeline, with one narrow exception: the examiner's opening line is a
fixed string (not LLM-generated) — see Known limitations above for why.

## Active speech provider
Rime is the only TTS path in this build — model `coda`, speaker
`bancroft`, language `en`. There is no fallback provider; if Rime is
unreachable, the agent has no alternate voice output (disclosed here per
the eligibility rules, not hidden).

## Credits & AI assistance disclosure
This project's architecture, backend code, frontend code, and documentation
were drafted with AI assistance (Claude) based on the team's problem
selection, product concept, and the DataForge 2026 Rime track brief.
Package names and API usage (LiveKit Agents, Groq plugin, Rime plugin,
`@livekit/components-react` hooks, `conversation_item_added` event,
`session.generate_reply(user_input=...)`) were verified against current
documentation fetched directly during development, and several real bugs
(a deprecated Groq model, a `voice=`/`speaker=` parameter mismatch, a
static-room-name dispatch failure, cross-service SQLite persistence) were
found and fixed through this process rather than assumed correct. The team
is responsible for understanding, testing, debugging, and defending every
component. Third-party services used: LiveKit Agents (transport/VAD), Groq
(LLM + STT), Rime (TTS, model Coda). No external code, weights, or assets
beyond these SDKs and APIs were reused.
[Update this with your team's actual names and any further edits you made.]
