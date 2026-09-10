import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { listSessions } from "../lib/api";

function formatDate(unixSeconds) {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(start, end) {
  if (!start || !end) return "—";
  const secs = Math.round(end - start);
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const row = {
  hidden: { opacity: 0, x: -12 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35 } },
};

export default function SessionHistoryList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSessions().then(setSessions).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="min-h-screen flex justify-start p-10">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col items-start gap-2.5 mb-6 pb-5 border-b border-rule">
          <span className="font-mono text-xs text-cyan">Barge-In Viva</span>
          <h1 className="font-display text-[26px] font-medium text-ink">Past sessions</h1>
          <button
            onClick={() => navigate("/")}
            className="rounded-md border border-rule-strong px-5 py-2.5 text-sm text-ink-dim transition-colors hover:border-cyan-soft hover:text-ink"
          >
            ← New session
          </button>
        </div>

        {error && <p className="text-sm text-interrupt">{error}</p>}
        {sessions === null && !error && <p className="py-6 text-sm text-ink-faint">Loading…</p>}
        {sessions?.length === 0 && (
          <p className="py-6 text-sm text-ink-faint">No sessions yet — start one from the home screen.</p>
        )}

        <motion.ul variants={list} initial="hidden" animate="show" className="flex flex-col gap-0.5">
          {sessions?.map((s) => (
            <motion.li key={s.id} variants={row}>
              <Link
                to={`/history/${s.id}`}
                className="flex items-center justify-between rounded-md px-3.5 py-4 text-ink no-underline transition-colors hover:bg-panel-raised"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{s.topic || "Untitled session"}</span>
                  <span className="font-mono text-xs text-ink-faint">{formatDate(s.started_at)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                      s.status === "active" ? "border-sage/40 text-sage" : "border-rule-strong text-ink-faint"
                    }`}
                  >
                    {s.status}
                  </span>
                  <span className="min-w-[60px] text-right font-mono text-xs text-ink-dim">
                    {formatDuration(s.started_at, s.ended_at)}
                  </span>
                </div>
              </Link>
            </motion.li>
          ))}
        </motion.ul>
      </div>
    </div>
  );
}
