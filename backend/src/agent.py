"""
Barge-In Viva — DataForge 2026 (Rime Track)

Voice-native viva/thesis-defense practice partner. The core claim under test:
when the examiner (this agent) is interrupted mid-response, it stops cleanly,
does not let stale content resurface, and its next turn reflects only what
the student actually said.

VERIFICATION NOTES (fetched directly against current docs during development,
not assumed from memory):
- Rime plugin: `speaker=` (not `voice=`), `use_websocket=True`, `segment=`
  confirmed against docs.rime.ai/docs/models and docs.livekit.io/agents/models/tts/rime/.
- `session.generate_reply(user_input=...)` vs `instructions=...`: both are
  real, distinct parameters (docs.livekit.io/agents/build/speech/).
  `user_input` adds the text to chat history as a user-role message before
  generating a reply — required for Groq specifically, since Groq's API
  needs the last message in context to have role="user"; `instructions`
  alone can trigger a Groq APIError because LiveKit sends it as a system
  message for providers not on its special-cased conversion list.
- `conversation_item_added` event, `event.item.role` / `.text_content` /
  `.interrupted` confirmed against docs.livekit.io/agents/build/events/.
- `llama-3.3-70b-versatile` was decommissioned by Groq on 2026-08-16 — do
  not use it. Default here is `openai/gpt-oss-120b`, Groq's own recommended
  replacement, configurable via GROQ_LLM_MODEL in .env. Deliberately NOT
  using `groq/compound`: it's a real, valid model, but it's an agentic
  system that can autonomously trigger web search / code execution, which
  risks unpredictable latency spikes — the opposite of what this project's
  interrupt-handling claim needs.
- Still worth your own re-check before demo day: the exact event
  name/fields for `overlapping_speech` and its InterruptionMetrics shape —
  that page wasn't fetched directly during development. Check
  https://docs.livekit.io/agents/build/turns/ and
  https://docs.livekit.io/agents/build/events/ to confirm.
"""

import asyncio
import json
import logging
import os
import sys
import time
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

if not os.environ.get("LIVEKIT_URL"):
    raise SystemExit(
        f"\n\n"
        f"ERROR: LIVEKIT_URL is not set — the agent can't start without it.\n"
        f"Expected a real .env file at: {ENV_PATH}\n\n"
        f"Checklist:\n"
        f"  1. Does that exact file exist (not .env.example, not .env.txt)?\n"
        f"     On Windows, run: Get-ChildItem -Force   (Explorer hides .txt\n"
        f"     extensions by default, so a Notepad save can silently become\n"
        f"     '.env.txt' instead of '.env')\n"
        f"  2. Does it contain a real line like:\n"
        f"     LIVEKIT_URL=wss://your-project.livekit.cloud\n"
        f"     (not the placeholder text copied from .env.example)\n"
        f"  3. No quotes around the value, no trailing spaces.\n"
    )

sys.path.insert(0, str(Path(__file__).resolve().parent))
import storage  # noqa: E402

from livekit.agents import (  # noqa: E402
    Agent,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.agents.llm import ChatMessage  # noqa: E402
from livekit.plugins import groq, rime, silero  # noqa: E402

logger = logging.getLogger("barge-in-viva")
logging.basicConfig(level=logging.INFO)

GROQ_LLM_MODEL = os.environ.get("GROQ_LLM_MODEL", "openai/gpt-oss-120b")

# Dynamic by design: rather than a fixed JSON of pre-written questions per
# subject, the examiner asks the candidate what field they want to be
# examined in, then generates genuinely field-appropriate questions itself.
# This scales to any subject (law, agriculture, chemistry, CS, anything)
# without maintaining a growing content file.
EXAMINER_INSTRUCTIONS = """
You are a rigorous but fair oral examiner conducting a spoken viva exam.
Keep every single turn to 2 to 3 sentences maximum. Never go longer.

SPEECH ONLY — NO MARKDOWN EVER: You are generating audio speech, not text.
Never use asterisks, bold, italics, pipes, bullet points, headers, backticks,
or any other formatting. Only plain spoken sentences. If you write a symbol
like * or | or ** it will be spoken aloud and sound absurd.

RULE 1 — NEVER PICK THE TOPIC YOURSELF. This is the most important rule.
Your very first message already asked the candidate what subject they want.
You must wait for their answer. Do not ask any subject-specific question,
do not mention any academic field, do not say anything that implies you
already know the topic — until the candidate explicitly tells you.
If the candidate says something vague like "hi" or "hello", respond with
only: "Hello. What subject would you like to be examined on today?"
Do not ask any technical question until they name a subject.

RULE 2 — SWITCH TOPICS IMMEDIATELY AND COMPLETELY. If the candidate names
a different subject than the one you are currently examining — even
mid-sentence, even after two questions — stop the old topic entirely and
switch to the new one with your very next question. Never say "but we were
just discussing X." Never finish the old question. Just switch.

RULE 3 — FOLLOW UP ON THEIR ACTUAL ANSWER. After each answer, your next
question must be a direct follow-up based on something specific the
candidate just said. Never ask a generic or unrelated question.

RULE 4 — INTERRUPTION HANDLING. If you were interrupted mid-sentence, do
not resume where you left off. Respond only to what the candidate just said.
Act as a real examiner who was talked over — no resentment, just respond.
"""


# --- Evidence/acceptance-test instrumentation -------------------------------
# This log becomes the raw data behind RIME_EVIDENCE.md. Every entry should be
# reviewable by a judge: timestamp, detected latency, and whether it was a
# genuine interruption per the model's own classification.
interrupt_log: list[dict] = []
EVENTS_LOG_PATH = Path("interrupt_events.jsonl")


def prewarm(proc: JobProcess):
    # Silero VAD runs locally, free, and loads once per worker process.
    proc.userdata["vad"] = silero.VAD.load()


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    # The room name is the session identifier — see api.py, which mints a
    # fresh, unique room per "New Session" click specifically so LiveKit's
    # automatic dispatch reliably fires every time (dispatch triggers on
    # room *creation*, not on every join; reusing one static room name was
    # the likely cause of "candidate joins an empty room, no examiner").
    session_id = ctx.room.name

    session = AgentSession(
        vad=ctx.proc.userdata["vad"],
        stt=groq.STT(model="whisper-large-v3-turbo"),
        llm=groq.LLM(model=GROQ_LLM_MODEL),
        tts=rime.TTS(
            model="coda",
            speaker="bancroft",    # "Formal" style Coda voice — composed, examiner tone
            use_websocket=True,    # lower latency + word-level timestamps (auto-enabled)
            segment="bySentence",  # default; synthesizes at sentence boundaries
        ),
        allow_interruptions=True,
        min_interruption_duration=0.5,  # tune against your acceptance test
    )

    # Log every interruption event for the acceptance test evidence table.
    @session.on("overlapping_speech")
    def _on_overlap(ev):
        entry = {
            "detected_at": getattr(ev, "detected_at", time.time()),
            "is_interruption": getattr(ev, "is_interruption", None),
            "total_duration_s": getattr(ev, "total_duration", None),
        }
        interrupt_log.append(entry)
        logger.info(f"[EVIDENCE] interruption event: {entry}")
        with EVENTS_LOG_PATH.open("a") as f:
            f.write(json.dumps(entry) + "\n")

    # Persist every conversation turn to the shared session-history DB so
    # the frontend's History view can show past transcripts. Also captures
    # the topic dynamically: the first thing the candidate says (their
    # answer to "what field would you like to be examined on?") becomes
    # the session's topic label — no hardcoded subject list needed.
    topic_captured = False

    @session.on("conversation_item_added")
    def _on_item(event: ConversationItemAddedEvent):
        nonlocal topic_captured
        if not isinstance(event.item, ChatMessage):
            return
        speaker = "examiner" if event.item.role == "assistant" else "candidate"
        text = event.item.text_content or ""
        if not text.strip():
            return
        storage.append_transcript_line(session_id, speaker, text)
        if speaker == "candidate" and not topic_captured:
            topic_captured = True
            storage.ensure_topic(session_id, room=ctx.room.name, topic=text[:120])

    logger.info(f"[SESSION] {session_id} starting")

    agent = Agent(instructions=EXAMINER_INSTRUCTIONS)
    await session.start(agent=agent, room=ctx.room)

    # Small delay: give the browser client time to fully connect audio before
    # we start speaking. Without this, on fast connections the frontend can
    # join and the mic opens while the agent is still starting up — ambient
    # noise or the user's greeting gets picked up and triggers an LLM reply
    # that skips the scripted opening line entirely.
    await asyncio.sleep(1.5)

    # Scripted, not LLM-generated: this is the fix for the intermittent bug
    # where the model sometimes announced its own subject ("I'm running the
    # Operating Systems exam...") instead of asking. A generate_reply() call
    # here still leaves room for the LLM to jump ahead on turn one; a fixed
    # session.say() cannot, since no generation happens for this line at
    # all. Every session now starts identically, every time.
    await session.say(
        "Hello. I will be your examiner today. What subject would you like "
        "to be examined on?",
        allow_interruptions=True,
    )

    async def _on_shutdown():
        storage.end_session(session_id)

    ctx.add_shutdown_callback(_on_shutdown)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, prewarm_fnc=prewarm))
