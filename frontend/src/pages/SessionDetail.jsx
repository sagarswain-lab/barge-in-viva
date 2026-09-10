import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { getSession } from "../lib/api";

export default function SessionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getSession(id).then(setSession).catch((err) => setError(err.message));
  }, [id]);

  return (
    <div className="min-h-screen flex justify-start p-10">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col items-start gap-2.5 mb-6 pb-5 border-b border-rule">
          <span className="font-mono text-xs text-cyan">Barge-In Viva</span>
          <h1 className="font-display text-[26px] font-medium text-ink">
            {session?.topic || "Session transcript"}
          </h1>
          <button
            onClick={() => navigate("/history")}
            className="rounded-md border border-rule-strong px-5 py-2.5 text-sm text-ink-dim transition-colors hover:border-cyan-soft hover:text-ink"
          >
            ← All sessions
          </button>
        </div>

        {error && <p className="text-sm text-interrupt">{error}</p>}
        {!session && !error && <p className="py-6 text-sm text-ink-faint">Loading…</p>}

        {session && (
          <div className="flex flex-col gap-4 py-5">
            {session.transcript.length === 0 && (
              <p className="py-6 text-sm text-ink-faint">No transcript was recorded for this session.</p>
            )}
            {session.transcript.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.03 }}
                className="text-sm leading-relaxed"
              >
                <span className={line.speaker === "candidate" ? "text-ink" : "text-cyan"}>
                  {line.text}
                </span>
              </motion.p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
