import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Slightly different height/delay per bar so the wave doesn't look mechanical
const BAR_PROFILES = [
  { base: 14, max: 34, delay: 0 },
  { base: 14, max: 52, delay: 0.08 },
  { base: 14, max: 68, delay: 0.16 },
  { base: 14, max: 48, delay: 0.24 },
  { base: 14, max: 30, delay: 0.32 },
];

/**
 * Visual state indicator matching LiveKit's own Playground look (vertical
 * bars, cyan). Maps directly onto useVoiceAssistant() state:
 *
 *  idle/connecting — short, static, dim bars
 *  listening       — gentle sage pulse (candidate's turn)
 *  thinking        — slow cyan pulse
 *  speaking        — full cyan wave animation
 *  interrupted     — a sharp red flash-and-collapse. UI-layer cue only —
 *                    the real, measured evidence lives in RIME_EVIDENCE.md.
 */
export default function AudioBars({ state, interruptSignal }) {
  const [fracture, setFracture] = useState(false);
  const lastSignal = useRef(interruptSignal);

  useEffect(() => {
    if (interruptSignal !== lastSignal.current) {
      lastSignal.current = interruptSignal;
      setFracture(true);
      const t = setTimeout(() => setFracture(false), 550);
      return () => clearTimeout(t);
    }
  }, [interruptSignal]);

  const visualState = fracture ? "interrupted" : state;

  const color =
    visualState === "speaking"
      ? "bg-cyan"
      : visualState === "listening"
        ? "bg-sage"
        : visualState === "interrupted"
          ? "bg-interrupt"
          : "bg-ink-faint";

  const glow =
    visualState === "speaking"
      ? "drop-shadow(0 0 14px var(--color-cyan-glow))"
      : visualState === "listening"
        ? "drop-shadow(0 0 10px var(--color-sage-glow))"
        : visualState === "interrupted"
          ? "drop-shadow(0 0 18px var(--color-interrupt-glow))"
          : "none";

  const label =
    visualState === "speaking"
      ? "Examiner speaking"
      : visualState === "thinking"
        ? "Examiner considering"
        : visualState === "listening"
          ? "Your turn"
          : visualState === "interrupted"
            ? "Interrupted"
            : "Awaiting session";

  return (
    <div className="flex flex-col items-center gap-5 py-8">
      <div className="flex items-end gap-2 h-20" style={{ filter: glow }}>
        {BAR_PROFILES.map((bar, i) => (
          <motion.div
            key={i}
            className={`w-2.5 rounded-full ${color}`}
            animate={
              visualState === "interrupted"
                ? { height: [bar.base, 4, bar.max * 0.6, bar.base] }
                : visualState === "speaking"
                  ? { height: [bar.base, bar.max, bar.base * 1.3, bar.max * 0.8, bar.base] }
                  : visualState === "listening"
                    ? { height: [bar.base, bar.base * 1.6, bar.base] }
                    : visualState === "thinking"
                      ? { height: [bar.base, bar.base * 1.15, bar.base] }
                      : { height: bar.base }
            }
            transition={
              visualState === "interrupted"
                ? { duration: 0.5, ease: [0.36, 0.07, 0.19, 0.97] }
                : {
                    duration: visualState === "speaking" ? 0.9 : 1.8,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: bar.delay,
                  }
            }
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={label}
          className="text-xs tracking-wide text-ink-dim font-body"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
