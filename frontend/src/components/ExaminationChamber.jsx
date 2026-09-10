import { useEffect, useRef, useState } from "react";
import {
  useVoiceAssistant,
  useLocalParticipant,
  useIsSpeaking,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import SessionHeader from "./SessionHeader";
import AudioBars from "./AudioBars";
import TranscriptLog from "./TranscriptLog";
import ControlBar from "./ControlBar";

/**
 * NOTE on the "interrupted" signal below: it's a UI-layer heuristic
 * (agent was speaking, then stopped, while the candidate was actively
 * talking) meant to drive the bars' flash animation for a good demo. It
 * is NOT the rigorous acceptance-test measurement — that lives
 * server-side in backend/tests/test_interrupt.py, timed against the
 * agent's own overlapping_speech event log. Cite RIME_EVIDENCE.md, not
 * this animation, as your evidence.
 */
export default function ExaminationChamber({ onEnd, topic }) {
  const connectionState = useConnectionState();
  const { state: agentState } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const isCandidateSpeaking = useIsSpeaking(localParticipant);

  const [interruptCount, setInterruptCount] = useState(0);
  const prevAgentState = useRef(agentState);

  useEffect(() => {
    if (
      prevAgentState.current === "speaking" &&
      agentState !== "speaking" &&
      isCandidateSpeaking
    ) {
      setInterruptCount((c) => c + 1);
    }
    prevAgentState.current = agentState;
  }, [agentState, isCandidateSpeaking]);

  const isLive = connectionState === ConnectionState.Connected;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-screen px-6 pt-7 pb-6">
      <SessionHeader topic={topic} isLive={isLive} />
      <AudioBars state={agentState} interruptSignal={interruptCount} />
      <TranscriptLog />
      <ControlBar onEnd={onEnd} />
    </div>
  );
}
