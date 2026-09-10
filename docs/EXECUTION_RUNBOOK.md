# Execution Runbook — Barge-In Viva

Everything in the repo is written and syntax-checked, but has never run against
real services (I have no live API access from where I build). This is the
literal checklist to take it from "written" to "submitted." Nothing here is
optional filler — each box is a real blocker for the next one.

## Day 1 — Accounts + first working voice loop
- [ ] Sign up: LiveKit Cloud, Groq Console, Rime (rime.ai) — ~10 min total
- [ ] `cd backend`, copy `.env.example` to `.env`, fill in all real keys
- [ ] `pip install -r requirements.txt`
- [ ] While that installs, open Rime's live voice catalog and actually listen
      to 3-5 Coda voices from the "Formal" or "Professional" style groups —
      pick one that sounds like an examiner. The code currently uses
      `speaker="bancroft"` (composed, formal) in `src/agent.py` — change the
      `speaker=` value there if you prefer a different one.
- [ ] Terminal 1: `python src/agent.py dev`
- [ ] Terminal 2: `python -m uvicorn api:app --reload --port 8000`
- [ ] Terminal 3: `cd ../frontend && npm install && cp .env.example .env && npm run dev`
      — open the printed local URL, click "Begin viva," allow mic access.
- [ ] **Manually interrupt it 5-10 times** by talking over it mid-sentence.
      Watch the agent terminal for `[EVIDENCE] interruption event: ...` lines,
      and watch the presence ring on screen fracture on interrupt.
- [ ] If that log line never appears: the `overlapping_speech` event name or
      enabling parameter has likely shifted since I wrote this. Paste me the
      exact terminal output (or lack of it) and I'll fix the code against
      what you're actually seeing.

## Day 2 — Harden interruption + build the test fixtures
- [ ] Based on how Day 1 felt, tune `min_interruption_duration` in
      `agent.py` (currently 0.5s) — lower if it feels sluggish to interrupt,
      higher if it's triggering on your own agent's audio bleeding into the
      mic.
- [ ] Interrupt it twice in a row quickly — confirm the session doesn't
      crash or hang. If it does, that's your first real "known limitation"
      for RIME_EVIDENCE.md — write down exactly what happened.
- [ ] Record two real WAV fixtures (phone voice memo is fine, trim with any
      free tool): a genuine ~8-10s viva answer, and a ~2-3s interrupting
      phrase like "wait, can you clarify that?" Save as
      `fixtures/student_turn_1.wav` and `fixtures/interrupt_1.wav`.
- [ ] With the agent running in one terminal, run
      `cd backend && python tests/test_interrupt.py` in another. Confirm it completes and
      produces `test_results.csv` — don't worry yet if the numbers look off,
      just confirm the mechanism runs end to end.
- [ ] Paste me any errors here — this script has the most unverified moving
      parts (LiveKit's raw `rtc` audio-publishing API).

## Day 3 — Collect real evidence
- [ ] Run the full test suite for real (10 single + 5 double interrupts).
- [ ] Listen back to at least a sample of the trials (or check your own
      terminal/session logs) to manually fill in the `stale_content` and
      `recovery_correct` columns — these can't be automated honestly, and
      the rubric explicitly wants disclosed manual review over a fake
      automated number.
- [ ] Copy the real results from `test_results.csv` into the Result table
      in `RIME_EVIDENCE.md`.
- [ ] Write the Limitations section based on what actually happened — a
      disclosed weakness scores better than a hidden one.
- [ ] If the examiner's dynamic questioning ever feels off-topic
      in practice, edit it now while it's fresh.

## Day 4 — Demo + submission
- [ ] Record the demo using `DEMO_SCRIPT.md` as your shot list — aim for
      one clean take, or 2-3 takes and pick the best. Recording locally is
      completely sufficient — deployment (below) is optional polish, not
      a requirement.
- [ ] **Optional, only if time allows:** deploy backend to Render (New →
      Blueprint → point at repo, root dir `backend`) and frontend to
      Vercel (root dir `frontend`, set `VITE_API_URL` to the Render URL).
      A live, always-on link is a nice-to-have for the presentation round,
      not something the Sep 8 submission requires — don't let this eat
      time you need for the acceptance test or the demo recording.
- [ ] Finish the remaining README.md sections (`Known limitations`,
      `What's live vs. precomputed`) using what you actually observed —
      not what you hoped would happen.
- [ ] Run the organizer's Rime config/secret preflight check if one is
      provided in the event's submission portal.
- [ ] `grep -r "your_actual_key_here_by_mistake"` style check — confirm no
      real API key ever got committed to the repo or appears anywhere in
      the recorded video (browser dev tools, terminal scrollback, etc.).
- [ ] Push to a public repo. Submit repo link + demo link with real margin
      before 11:59 PM — not at 11:58.

## If something breaks
Paste me the exact error/traceback, not a description of it — I can fix
code against a real error far more reliably than against "it didn't work."
