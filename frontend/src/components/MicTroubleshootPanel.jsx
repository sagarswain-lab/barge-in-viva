import { motion } from "framer-motion";

export default function MicTroubleshootPanel({ result }) {
  if (!result || result.ok) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      transition={{ duration: 0.3 }}
      className="mt-5 overflow-hidden rounded-md border border-interrupt/40 bg-interrupt/10 px-4 py-3.5"
    >
      <p className="text-sm text-interrupt">{result.message}</p>
      <ul className="mt-2 list-disc pl-4 text-[13px] leading-relaxed text-ink-dim">
        {result.troubleshoot?.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ul>
    </motion.div>
  );
}
