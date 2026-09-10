# Frontend

React + Vite client for Barge-In Viva. Tailwind CSS v4 for styling
(near-black surface, cyan accent — matches the LiveKit Playground
reference look), Framer Motion for entrance/transition/interrupt
animations, real-time voice UI via `livekit-client` and
`@livekit/components-react`, client-side routing via `react-router-dom`.

See the root `README.md` for full setup and deployment instructions
covering both frontend and backend together.

## Local development
```bash
npm install
cp .env.example .env
npm run dev
```
Requires the backend (`api.py` + `agent.py`) running.

## Deploying to Vercel
See `../DEPLOY.md` for the full walkthrough.
