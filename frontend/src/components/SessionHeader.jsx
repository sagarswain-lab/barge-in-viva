import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function SessionHeader({ topic, isLive }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isLive) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 500);
    return () => clearInterval(id);
  }, [isLive]);

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-start justify-between border-b border-rule pb-5"
    >
      <div>
        <span className="block font-mono text-[11px] tracking-wide text-ink-faint mb-1.5">
          Barge-In Viva
        </span>
        <h1 className="font-display text-xl font-medium text-ink truncate max-w-xs">
          {topic || "Assigning topic…"}
        </h1>
      </div>
      <div className="flex items-center gap-2 pt-0.5 text-xs text-ink-dim whitespace-nowrap">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            isLive ? "bg-interrupt shadow-[0_0_6px_var(--color-interrupt-glow)] animate-pulse" : "bg-ink-faint"
          }`}
        />
        <span>{isLive ? "In session" : "Not started"}</span>
        <span className="font-mono text-ink-dim ml-1">{formatElapsed(elapsed)}</span>
      </div>
    </motion.header>
  );
}
