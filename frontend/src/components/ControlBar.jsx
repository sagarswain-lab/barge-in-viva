import { Track } from "livekit-client";
import { useTrackToggle } from "@livekit/components-react";
import { motion } from "framer-motion";

export default function ControlBar({ onEnd }) {
  const { buttonProps, enabled, pending } = useTrackToggle({ source: Track.Source.Microphone });

  return (
    <div className="flex gap-2.5 pt-4 border-t border-rule">
      <motion.button
        {...buttonProps}
        whileTap={{ scale: 0.97 }}
        className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors
          ${enabled ? "border-sage text-ink" : "border-rule-strong text-ink-dim bg-panel-raised"}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-sage shadow-[0_0_5px_var(--color-sage-glow)]" : "bg-ink-faint"}`} />
        {pending ? "Switching…" : enabled ? "Mic live" : "Mic muted"}
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onEnd}
        className="flex-1 rounded-md border border-rule-strong px-4 py-3 text-sm text-ink-faint transition-colors hover:border-interrupt hover:text-interrupt"
      >
        End session
      </motion.button>
    </div>
  );
}
