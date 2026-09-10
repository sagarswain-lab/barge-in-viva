import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { createSession } from "../lib/api";
import { checkMicrophoneAccess } from "../lib/micCheck";
import MicTroubleshootPanel from "../components/MicTroubleshootPanel";

/* ─── tiny animation helpers ─────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};
const stagger = (delay = 0) => ({
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
  },
});

function Section({ children, className = "", id }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      id={id}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/* ─── animated audio bars (decorative, always-speaking) ─────── */
const BAR_PROFILES = [
  { max: 28, delay: 0 },
  { max: 48, delay: 0.1 },
  { max: 64, delay: 0.2 },
  { max: 44, delay: 0.3 },
  { max: 24, delay: 0.4 },
  { max: 56, delay: 0.05 },
  { max: 36, delay: 0.25 },
];

function DecorativeBars({ color = "cyan", scale = 1 }) {
  const colorMap = {
    cyan: "var(--color-cyan)",
    interrupt: "var(--color-interrupt)",
    sage: "var(--color-sage)",
  };
  return (
    <div
      className="flex items-end gap-1.5"
      style={{ height: `${64 * scale}px`, filter: `drop-shadow(0 0 12px ${colorMap[color]}55)` }}
    >
      {BAR_PROFILES.map((bar, i) => (
        <motion.div
          key={i}
          style={{
            width: `${9 * scale}px`,
            borderRadius: 9999,
            background: colorMap[color],
          }}
          animate={{ height: [10, bar.max * scale, 10 * scale, bar.max * scale * 0.6, 10] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
            delay: bar.delay,
          }}
        />
      ))}
    </div>
  );
}

/* ─── step card ─────────────────────────────────────────────── */
function StepCard({ number, title, desc, color = "cyan", delay = 0 }) {
  const colorStyle =
    color === "cyan"
      ? { border: "1px solid rgba(34,211,238,0.25)", bg: "rgba(34,211,238,0.07)" }
      : color === "interrupt"
        ? { border: "1px solid rgba(242,84,91,0.25)", bg: "rgba(242,84,91,0.07)" }
        : { border: "1px solid rgba(74,222,128,0.25)", bg: "rgba(74,222,128,0.07)" };
  const accentColor =
    color === "cyan"
      ? "var(--color-cyan)"
      : color === "interrupt"
        ? "var(--color-interrupt)"
        : "var(--color-sage)";

  return (
    <motion.div
      variants={stagger(delay)}
      style={{ border: colorStyle.border, background: colorStyle.bg }}
      className="rounded-xl p-7 flex flex-col gap-3 relative overflow-hidden hover:scale-[1.02] transition-transform duration-300"
    >
      <span
        className="font-bold font-display absolute -top-2 -right-1 select-none pointer-events-none"
        style={{ color: `${accentColor}10`, fontSize: "5rem" }}
      >
        {number}
      </span>
      <span
        className="font-mono text-xs font-medium px-2.5 py-1 rounded-full w-fit"
        style={{ color: accentColor, background: colorStyle.bg, border: colorStyle.border }}
      >
        Step {number}
      </span>
      <h3 className="text-lg font-semibold text-ink leading-snug">{title}</h3>
      <p className="text-sm text-ink-dim leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* ─── feature card ─────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, delay = 0 }) {
  return (
    <motion.div
      variants={stagger(delay)}
      className="rounded-xl border border-rule p-6 flex flex-col gap-3 bg-panel hover:border-rule-strong hover:bg-panel-raised transition-all duration-300"
    >
      <div className="text-2xl">{icon}</div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="text-sm text-ink-dim leading-relaxed">{desc}</p>
    </motion.div>
  );
}

/* ─── tech badge ─────────────────────────────────────────────── */
function TechBadge({ name, role, color = "#22d3ee" }) {
  return (
    <div
      className="rounded-lg px-4 py-3 flex flex-col gap-1 border"
      style={{ borderColor: `${color}33`, background: `${color}08` }}
    >
      <span className="text-xs font-mono" style={{ color }}>{role}</span>
      <span className="text-sm font-semibold text-ink">{name}</span>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("idle");
  const [micResult, setMicResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);

  const begin = async () => {
    setErrorMessage("");
    setMicResult(null);
    setPhase("checking-mic");
    const mic = await checkMicrophoneAccess();
    if (!mic.ok) {
      setMicResult(mic);
      setPhase("error");
      return;
    }
    setPhase("connecting");
    try {
      const session = await createSession();
      navigate("/session", { state: session });
    } catch (err) {
      setErrorMessage(err.message || "Could not start a session.");
      setPhase("error");
    }
  };

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* ── global background ─────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, rgba(34,211,238,0.12) 0%, transparent 60%), linear-gradient(to bottom, #08090a 0%, #08090a 100%)`,
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(231,234,236,0.5) 40px), repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(231,234,236,0.5) 40px)`,
        }}
      />

      {/* ── sticky nav ───────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between"
        style={{
          background: "rgba(8,9,10,0.7)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(231,234,236,0.06)",
        }}
      >
        <span className="font-mono text-sm font-medium tracking-widest" style={{ color: "var(--color-cyan)" }}>
          BARGE-IN VIVA
        </span>
        <div className="flex items-center gap-6">
          <button onClick={() => scrollToSection("how-it-works")} className="text-sm text-ink-dim hover:text-ink transition-colors hidden sm:block">
            How it works
          </button>
          <button onClick={() => scrollToSection("features")} className="text-sm text-ink-dim hover:text-ink transition-colors hidden sm:block">
            Features
          </button>
          <button onClick={() => navigate("/history")} className="text-sm text-ink-dim hover:text-ink transition-colors">
            History
          </button>
          <button
            onClick={begin}
            disabled={phase === "checking-mic" || phase === "connecting"}
            className="rounded-md px-4 py-2 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-60"
            style={{ background: "var(--color-cyan)" }}
          >
            {phase === "checking-mic" ? "Checking…" : phase === "connecting" ? "Connecting…" : "Begin viva →"}
          </button>
        </div>
      </motion.nav>

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-24 pb-12 text-center"
      >
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="flex flex-col items-center gap-8 max-w-4xl">
          {/* eyebrow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-mono font-medium"
            style={{ border: "1px solid rgba(34,211,238,0.3)", background: "rgba(34,211,238,0.08)", color: "var(--color-cyan)" }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-cyan)" }} />
            Voice-Native Oral Exam Practice
          </motion.div>

          {/* headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-5xl sm:text-6xl md:text-7xl font-medium leading-[1.05] text-ink"
          >
            Oral practice, run the{" "}
            <span
              className="italic"
              style={{ backgroundImage: "linear-gradient(90deg, var(--color-cyan), #6366f1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              way a real
            </span>
            {" "}examiner would.
          </motion.h1>

          {/* sub */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.28 }}
            className="text-lg text-ink-dim max-w-xl leading-relaxed"
          >
            Tell the examiner any subject — computer science, law, agriculture, anything.
            Interrupt it, redirect it, and see whether it recovers cleanly.{" "}
            <span className="text-ink">The skill a text quiz can't train.</span>
          </motion.p>

          {/* decorative bars */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="flex items-end gap-3"
          >
            <DecorativeBars color="sage" scale={0.6} />
            <DecorativeBars color="cyan" scale={1} />
            <DecorativeBars color="interrupt" scale={0.6} />
          </motion.div>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <button
              onClick={begin}
              disabled={phase === "checking-mic" || phase === "connecting"}
              className="group rounded-xl px-8 py-4 text-base font-semibold text-black transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center gap-2"
              style={{ background: "var(--color-cyan)", boxShadow: "0 0 32px rgba(34,211,238,0.3)" }}
            >
              <span className="text-lg">🎙</span>
              {phase === "checking-mic" ? "Checking microphone…" : phase === "connecting" ? "Connecting…" : "Begin viva"}
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button
              onClick={() => navigate("/history")}
              className="rounded-xl border px-8 py-4 text-base text-ink-dim transition-all hover:border-rule-strong hover:text-ink hover:-translate-y-0.5"
              style={{ borderColor: "var(--color-rule-strong)" }}
            >
              View past sessions
            </button>
          </motion.div>

          <MicTroubleshootPanel result={micResult} />
          <AnimatePresence>
            {phase === "error" && errorMessage && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm" style={{ color: "var(--color-interrupt)" }}>
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.8 }}
          className="absolute bottom-8 flex flex-col items-center gap-2 cursor-pointer"
          onClick={() => scrollToSection("how-it-works")}
        >
          <span className="text-xs text-ink-faint font-mono">scroll to explore</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} className="text-ink-faint">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════
          THE PROBLEM
      ══════════════════════════════════════════════════════ */}
      <Section id="problem" className="relative z-10 px-6 py-24 max-w-5xl mx-auto">
        <motion.div variants={fadeUp} className="mb-12 text-center">
          <span className="font-mono text-xs text-ink-faint tracking-widest uppercase">The Problem</span>
          <h2 className="mt-3 font-display text-3xl sm:text-4xl font-medium text-ink">
            Text quizzes can't train{" "}
            <span className="italic" style={{ color: "var(--color-interrupt)" }}>real</span>
            {" "}exam skills.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            variants={stagger(0.1)}
            className="rounded-xl p-8"
            style={{ border: "1px solid rgba(242,84,91,0.2)", background: "rgba(242,84,91,0.04)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">❌</span>
              <h3 className="font-semibold text-ink">Text-based prep</h3>
            </div>
            <ul className="space-y-3">
              {[
                "Can't simulate an examiner cutting you off mid-sentence",
                "No pressure to think on your feet while speaking",
                "Flashcards reward memory, not composure",
                "Zero real-time interruption & recovery practice",
              ].map((item) => (
                <li key={item} className="text-sm text-ink-dim flex gap-2.5">
                  <span style={{ color: "var(--color-interrupt)" }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={stagger(0.2)}
            className="rounded-xl p-8"
            style={{ border: "1px solid rgba(34,211,238,0.2)", background: "rgba(34,211,238,0.04)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">✅</span>
              <h3 className="font-semibold text-ink">Barge-In Viva</h3>
            </div>
            <ul className="space-y-3">
              {[
                "AI examiner interrupts mid-answer, just like a real viva",
                "Redirects questions without warning — stay composed",
                "Any subject: law, CS, medicine, agriculture…",
                "Recover cleanly. Build the skill that actually matters.",
              ].map((item) => (
                <li key={item} className="text-sm text-ink-dim flex gap-2.5">
                  <span style={{ color: "var(--color-cyan)" }}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <Section
        id="how-it-works"
        className="relative z-10 px-6 py-24"
        style={{ background: "linear-gradient(to bottom, transparent, rgba(14,16,18,0.8) 20%, rgba(14,16,18,0.8) 80%, transparent)" }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="mb-14 text-center">
            <span className="font-mono text-xs text-ink-faint tracking-widest uppercase">How it works</span>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-medium text-ink">Three steps to a tougher viva.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-5">
            <StepCard
              number="01"
              title="Name your subject"
              desc="Tell the AI examiner any topic — computer science, constitutional law, organic chemistry, anything. It generates field-appropriate questions on the fly."
              color="cyan"
              delay={0.05}
            />
            <StepCard
              number="02"
              title="Answer out loud"
              desc="Speak your answer into your mic. The examiner listens via Groq Whisper STT and responds with a follow-up, pushback, or redirect — all in real time."
              color="sage"
              delay={0.15}
            />
            <StepCard
              number="03"
              title="Handle the barge-in"
              desc="At any moment the AI may cut in mid-sentence. Recover, pivot, or push back. The Rime TTS voice snaps back into examiner-mode cleanly. That's the skill."
              color="interrupt"
              delay={0.25}
            />
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════
          AUDIO PIPELINE VISUALIZATION
      ══════════════════════════════════════════════════════ */}
      <Section className="relative z-10 px-6 py-20 max-w-4xl mx-auto">
        <motion.div variants={fadeUp} className="mb-12 text-center">
          <span className="font-mono text-xs text-ink-faint tracking-widest uppercase">The pipeline</span>
          <h2 className="mt-3 font-display text-3xl font-medium text-ink">Every word, live — nothing precomputed.</h2>
          <p className="mt-4 text-ink-dim text-base max-w-lg mx-auto">
            Real STT, real LLM reasoning, real Rime synthesis, real interruption detection — every time.
          </p>
        </motion.div>

        <motion.div variants={stagger(0.1)}>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-2">
            {[
              { label: "Your voice", sub: "browser mic", color: "var(--color-sage)" },
              { label: "→", arrow: true },
              { label: "LiveKit", sub: "transport + VAD", color: "var(--color-cyan)" },
              { label: "→", arrow: true },
              { label: "Groq Whisper", sub: "STT large-v3-turbo", color: "var(--color-cyan)" },
              { label: "→", arrow: true },
              { label: "Groq LLM", sub: "dynamic reasoning", color: "var(--color-cyan)" },
              { label: "→", arrow: true },
              { label: "Rime TTS", sub: "Coda · bancroft voice", color: "#a78bfa" },
              { label: "→", arrow: true },
              { label: "Your ears", sub: "WebRTC audio", color: "var(--color-sage)" },
            ].map((node, i) =>
              node.arrow ? (
                <span key={i} className="text-ink-faint text-xl font-light">{node.label}</span>
              ) : (
                <div
                  key={i}
                  className="rounded-lg px-4 py-3 text-center min-w-[100px]"
                  style={{ border: `1px solid ${node.color}33`, background: `${node.color}0d` }}
                >
                  <div className="text-sm font-semibold" style={{ color: node.color }}>{node.label}</div>
                  {node.sub && <div className="text-xs text-ink-faint mt-0.5">{node.sub}</div>}
                </div>
              )
            )}
          </div>

          <motion.div
            variants={stagger(0.3)}
            className="mt-8 rounded-xl p-5 flex items-center gap-4"
            style={{ border: "1px solid rgba(242,84,91,0.2)", background: "rgba(242,84,91,0.04)" }}
          >
            <div className="flex-shrink-0"><DecorativeBars color="interrupt" scale={0.45} /></div>
            <div>
              <p className="text-sm font-semibold text-ink mb-1">Silero VAD detects your barge-in</p>
              <p className="text-xs text-ink-dim">
                LiveKit's VAD catches overlapping speech and fires the{" "}
                <code className="rounded px-1.5 py-0.5 font-mono" style={{ background: "rgba(242,84,91,0.12)", color: "var(--color-interrupt)" }}>
                  overlapping_speech
                </code>{" "}
                event — the examiner stops mid-word. Logged to{" "}
                <code className="font-mono text-ink-faint">interrupt_events.jsonl</code> for acceptance testing.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </Section>

      {/* ══════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════ */}
      <Section id="features" className="relative z-10 px-6 py-24" style={{ background: "rgba(14,16,18,0.5)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} className="mb-14 text-center">
            <span className="font-mono text-xs text-ink-faint tracking-widest uppercase">Features</span>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-medium text-ink">Built for the hardest voice problems.</h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard icon="⚡" title="True barge-in handling" desc="The examiner stops mid-word when you interrupt — no awkward waiting. The hardest voice mechanic, solved." delay={0} />
            <FeatureCard icon="🎙" title="Any subject, live" desc="No fixed question banks. The LLM generates real, field-appropriate questions based on the topic you name — law, CS, medicine, anything." delay={0.08} />
            <FeatureCard icon="🗣" title="Formal examiner voice" desc="Rime TTS Coda with the 'bancroft' speaker — a composed, formal-register voice chosen specifically for the examiner persona." delay={0.16} />
            <FeatureCard icon="📜" title="Session history" desc="Every turn is saved. Review your full transcript, see where you got interrupted, replay any past session detail." delay={0.24} />
            <FeatureCard icon="🔒" title="Unique room per session" desc="Each 'Begin viva' click creates a fresh LiveKit room. No shared state, no agent dispatch bugs — clean isolation every time." delay={0.32} />
            <FeatureCard icon="📊" title="Evidence-backed" desc="Interrupt events are logged to interrupt_events.jsonl and verified by an automated acceptance-test harness — evidence, not claims." delay={0.4} />
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════
          TECH STACK
      ══════════════════════════════════════════════════════ */}
      <Section className="relative z-10 px-6 py-24 max-w-5xl mx-auto">
        <motion.div variants={fadeUp} className="mb-12 text-center">
          <span className="font-mono text-xs text-ink-faint tracking-widest uppercase">Tech Stack</span>
          <h2 className="mt-3 font-display text-3xl font-medium text-ink">State-of-the-art, all free-tier.</h2>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { name: "LiveKit Agents", role: "Transport + VAD", color: "#22d3ee" },
            { name: "Groq Whisper", role: "STT · large-v3-turbo", color: "#22d3ee" },
            { name: "Groq LLM", role: "Language Model", color: "#22d3ee" },
            { name: "Rime TTS · Coda", role: "Text-to-Speech", color: "#a78bfa" },
            { name: "Silero VAD", role: "Voice Activity", color: "#4ade80" },
            { name: "FastAPI", role: "Backend API", color: "#4ade80" },
            { name: "React + Vite", role: "Frontend", color: "#f472b6" },
            { name: "Framer Motion", role: "Animations", color: "#f472b6" },
          ].map((t, i) => (
            <motion.div key={t.name} variants={stagger(i * 0.04)}>
              <TechBadge {...t} />
            </motion.div>
          ))}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <Section className="relative z-10 px-6 py-32 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="w-[600px] h-[300px] rounded-full blur-[80px]" style={{ background: "radial-gradient(ellipse, rgba(34,211,238,0.15), transparent 70%)" }} />
        </div>

        <div className="relative max-w-2xl mx-auto flex flex-col items-center gap-8">
          <motion.div variants={stagger(0)}>
            <div className="flex justify-center mb-6"><DecorativeBars color="cyan" scale={0.9} /></div>
            <h2 className="font-display text-4xl sm:text-5xl font-medium text-ink leading-tight">
              Ready to face the examiner?
            </h2>
            <p className="mt-5 text-ink-dim text-lg leading-relaxed">
              One click. Microphone on. The examiner starts immediately — and might interrupt your first sentence.
            </p>
          </motion.div>

          <motion.div variants={stagger(0.1)} className="flex flex-wrap gap-4 justify-center">
            <button
              onClick={begin}
              disabled={phase === "checking-mic" || phase === "connecting"}
              className="group rounded-xl px-10 py-4 text-base font-semibold text-black transition-all hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 flex items-center gap-2.5"
              style={{ background: "var(--color-cyan)", boxShadow: "0 0 40px rgba(34,211,238,0.35)" }}
            >
              <span className="text-xl">🎙</span>
              {phase === "checking-mic" ? "Checking microphone…" : phase === "connecting" ? "Connecting…" : "Begin viva now"}
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
            <button
              onClick={() => navigate("/history")}
              className="rounded-xl border px-8 py-4 text-base text-ink-dim transition-all hover:border-rule-strong hover:text-ink hover:-translate-y-0.5"
              style={{ borderColor: "var(--color-rule-strong)" }}
            >
              View past sessions
            </button>
          </motion.div>

          <MicTroubleshootPanel result={micResult} />
          <AnimatePresence>
            {phase === "error" && errorMessage && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm" style={{ color: "var(--color-interrupt)" }}>
                {errorMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </Section>

      {/* ── footer ──────────────────────────────────────────── */}
      <footer className="relative z-10 px-6 py-8 text-center border-t" style={{ borderColor: "var(--color-rule)" }}>
        <p className="text-xs text-ink-faint font-mono">
          BARGE-IN VIVA · DataForge 2026 · Rime Track ·{" "}
          <span style={{ color: "var(--color-cyan)" }}>LiveKit · Groq · Rime</span>
        </p>
      </footer>
    </div>
  );
}
