import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import ExaminationChamber from "../components/ExaminationChamber";
import { getSession } from "../lib/api";

export default function LiveSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const connection = location.state; // { token, url, identity, room, session_id }
  const [topic, setTopic] = useState(null);

  // Refreshing this page loses the token (it's only in router state, never
  // the URL, deliberately — a token shouldn't sit in a shareable link).
  useEffect(() => {
    if (!connection) {
      navigate("/", { replace: true });
    }
  }, [connection, navigate]);

  // agent.py picks the topic server-side and writes it to the session
  // record; poll briefly until it shows up rather than leaving the header
  // blank for the whole session.
  useEffect(() => {
    if (!connection?.session_id || topic) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const session = await getSession(connection.session_id);
        if (!cancelled && session.topic) {
          setTopic(session.topic);
          clearInterval(interval);
        }
      } catch {
        /* backend may not be reachable yet on first tick — keep trying */
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [connection, topic]);

  if (!connection) return null;

  const end = () => navigate("/");

  return (
    <LiveKitRoom
      serverUrl={connection.url}
      token={connection.token}
      connect
      audio
      onDisconnected={end}
      onError={(err) => {
        console.error("LiveKit connection error:", err);
        end();
      }}
      className="app-root"
    >
      <RoomAudioRenderer />
      <ExaminationChamber onEnd={end} topic={topic} />
    </LiveKitRoom>
  );
}
