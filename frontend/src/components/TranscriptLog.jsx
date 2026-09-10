import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalParticipant, useTranscriptions } from "@livekit/components-react";

export default function TranscriptLog() {
  const transcriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions.length]);

  if (transcriptions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-ink-faint text-sm">
        <p>The exchange will be transcribed here as it happens.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      className="flex-1 overflow-y-auto flex flex-col gap-4 px-1 py-2"
    >
      <AnimatePresence initial={false}>
        {transcriptions.map((segment, i) => {
          const isCandidate = segment.participantInfo?.identity === localParticipant.identity;
          return (
            <motion.p
              key={`${segment.streamInfo?.id ?? i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="text-sm leading-relaxed"
            >
              <span className={isCandidate ? "text-ink" : "text-cyan"}>
                {segment.text}
              </span>
            </motion.p>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
