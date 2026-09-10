# Deployment Guide — Barge-In Viva

This covers deploying the backend to Render and the frontend to Vercel.
**This is optional polish** — the Sep 8 submission only requires a demo
recording and a public source repo, not a live hosted link. Only follow
this if the core build (interrupt logic, acceptance test, demo) is already
done with time to spare. Don't let deployment eat time you need elsewhere.

Total time if everything goes smoothly: ~25–35 minutes.

---

## Prerequisites

- This repo pushed to a **public GitHub repository** (both Render and
  Vercel deploy from a connected Git repo, not a zip upload).
- Accounts: [Render](https://render.com), [Vercel](https://vercel.com) —
  both have free tiers sufficient for this project. Sign up with GitHub
  for the smoothest connected-repo experience.
- Your real API keys for LiveKit, Groq, and Rime ready to paste in — have
  these open in a notes file before you start so you're not hunting for
  them mid-deploy.

---

## Part 1 — Backend to Render

The backend deploys as **three things from one blueprint**: the API (web
service), the agent worker (background worker), and a shared Postgres
database. `backend/render.yaml` already defines all three.

### 1.1 Create the Blueprint
1. Go to the [Render Dashboard](https://dashboard.render.com/).
2. Click **New → Blueprint**.
3. Connect your GitHub account if you haven't, then select this repo.
4. Render will detect `render.yaml`. **Set the root directory to `backend`**
   if it asks — this repo has the blueprint inside `backend/`, not at the
   repo root.
5. Click **Apply**. Render will start provisioning:
   - `barge-in-viva-db` (Postgres, free tier)
   - `barge-in-viva-api` (web service)
   - `barge-in-viva-agent` (background worker)

### 1.2 Fill in the secrets
The blueprint deliberately does **not** include your real API keys (they're
marked `sync: false` so nothing sensitive sits in the repo). After the
first deploy attempt (it will fail or sit incomplete until you do this):

1. Go to **barge-in-viva-api** → **Environment** tab. Add:
   - `LIVEKIT_URL` — e.g. `wss://your-project.livekit.cloud`
   - `LIVEKIT_API_KEY`
   - `LIVEKIT_API_SECRET`
   - `FRONTEND_ORIGIN` — leave as `*` for now; you'll come back and set
     this to your real Vercel URL in Part 3.
2. Go to **barge-in-viva-agent** → **Environment** tab. Add:
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (same values
     as above)
   - `GROQ_API_KEY`
   - `RIME_API_KEY`
   - `GROQ_LLM_MODEL` should already be set to `openai/gpt-oss-120b` from
     the blueprint — change it here if you want a different model.
3. `DATABASE_URL` is **already wired automatically** on both services via
   `fromDatabase` in the blueprint — you don't need to touch it.

Each service redeploys automatically after you save environment variables.

### 1.3 Verify the backend is actually working
1. Open **barge-in-viva-api**'s page in Render, copy its public URL (looks
   like `https://barge-in-viva-api.onrender.com`).
2. Visit `<that-url>/health` in your browser — you should see
   `{"status": "ok"}`. If you get an error, check the **Logs** tab on that
   service for the actual traceback.
3. Open **barge-in-viva-agent** → **Logs**. You should see it log that it
   registered as a worker and is waiting for jobs. If it crashed, the
   logs will show why — usually a missing/wrong env var.

**Known free-tier quirk:** Render's free web services "spin down" after
15 minutes of no traffic and take ~30–60 seconds to wake up on the next
request. If a demo call to `/sessions` seems to hang at first, that's why
— it's not broken, just cold-starting. The background worker (agent) does
not spin down the same way, but check its logs if a session doesn't get
an examiner within a few seconds.

---

## Part 2 — Frontend to Vercel

### 2.1 Import the project
1. Go to the [Vercel Dashboard](https://vercel.com/new).
2. Import the same GitHub repo.
3. When configuring the project, set **Root Directory** to `frontend`.
4. Framework Preset should auto-detect as **Vite** — leave build/output
   settings at their defaults.

### 2.2 Set the environment variable
Before clicking Deploy (or after, then redeploy):
- Add environment variable `VITE_API_URL` = the Render API URL from step
  1.3 above (e.g. `https://barge-in-viva-api.onrender.com`).
- Apply it to all environments (Production, Preview, Development) unless
  you specifically want different backends per environment.

### 2.3 Deploy
Click **Deploy**. Vercel builds and gives you a URL like
`https://barge-in-viva.vercel.app`.

`vercel.json` (already in the repo) handles client-side routing, so
reloading the page on `/history` or `/session` won't 404 — Vercel serves
`index.html` for any path and React Router takes over from there.

---

## Part 3 — Connect them (CORS)

Right now the backend's `FRONTEND_ORIGIN` is still `*` (open to any
origin), which works but is loose. Tighten it:

1. Copy your real Vercel URL (from step 2.3).
2. In Render, go to **barge-in-viva-api → Environment**, set
   `FRONTEND_ORIGIN` to that exact URL (no trailing slash), e.g.:
   ```
   FRONTEND_ORIGIN=https://barge-in-viva.vercel.app
   ```
3. Save — the API service redeploys automatically.

If you later get a Vercel **preview** URL (a different domain per PR/branch)
and need that to work too, set `FRONTEND_ORIGIN` to a comma-separated list;
`api.py` already parses multiple origins if present.

---

## Post-deploy checklist

- [ ] Visit your Vercel URL. Click "Begin viva." Allow mic access.
- [ ] Confirm you hear the examiner ask a real question within a few
      seconds (allow extra time on first request if Render's free tier
      needed to wake up — see the cold-start note above).
- [ ] Talk over the examiner mid-sentence — confirm the presence ring
      fractures and audio actually stops.
- [ ] End the session, go to "View past sessions" — confirm it shows up
      with a real topic and transcript (this specifically proves the
      shared Postgres database is working across both Render services).
- [ ] Open the same Vercel URL from a different device/network if
      possible, to confirm nothing was accidentally hardcoded to
      `localhost`.

---

## Troubleshooting

**Frontend loads but "Begin viva" errors immediately:**
Check the browser console. If it's a CORS error, `FRONTEND_ORIGIN` on the
API doesn't match your actual Vercel URL exactly (check for trailing
slashes or `http` vs `https`). If it's a network error, `VITE_API_URL` in
Vercel's environment variables is probably wrong or the Render API is
still cold-starting — wait 30 seconds and retry.

**Session starts, mic works, but no examiner ever speaks:**
Check the `barge-in-viva-agent` logs on Render. Common causes: a missing
env var (`GROQ_API_KEY` or `RIME_API_KEY` not set on the *worker* service
specifically, not just the API service — they're separate services with
separate env vars), or the worker crashed on startup.

**History page shows sessions but transcripts are empty:**
This means the agent joined and ran, but `conversation_item_added` events
aren't reaching `storage.py` — check the agent's logs for Python errors
around that event handler, and confirm `DATABASE_URL` is actually set on
the agent service (not just the API service).

**Everything worked locally but broke after deploying:**
That's expected the first time — paste me the exact error from Render's
logs or the browser console and I'll fix it against what's actually
happening, same as with local errors.
