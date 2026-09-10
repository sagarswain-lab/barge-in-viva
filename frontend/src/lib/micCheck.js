/**
 * Checks microphone availability BEFORE attempting to join a LiveKit room.
 *
 * Why this exists: LiveKitRoom's audio={true} prop throws a raw,
 * hard-to-read error if the mic is already locked by another app (Zoom,
 * Teams, Discord, OBS, or Windows' "exclusive mode" for an input device).
 * Checking first with a plain getUserMedia call lets us show a specific,
 * actionable message instead of a stack trace.
 *
 * Returns { ok: true } or { ok: false, reason: 'not-readable' | 'denied' | 'not-found' | 'unknown', message }.
 */
export async function checkMicrophoneAccess() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop the test stream — we only needed to confirm access,
    // not hold the device open before the real LiveKit connection does.
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (err) {
    if (err.name === "NotReadableError") {
      return {
        ok: false,
        reason: "not-readable",
        message: "Your microphone is being used by another app.",
        troubleshoot: [
          "Close Zoom, Teams, Discord, OBS, or any other app using the mic.",
          "On Windows, check Settings → Privacy → Microphone → \"exclusive mode\" isn't locking the device to one app.",
          "Try unplugging and reconnecting an external mic/headset.",
        ],
      };
    }
    if (err.name === "NotAllowedError") {
      return {
        ok: false,
        reason: "denied",
        message: "Microphone access was blocked.",
        troubleshoot: [
          "Click the lock/camera icon in your browser's address bar and allow microphone access.",
          "Reload the page after granting permission.",
        ],
      };
    }
    if (err.name === "NotFoundError") {
      return {
        ok: false,
        reason: "not-found",
        message: "No microphone was detected on this device.",
        troubleshoot: [
          "Connect a microphone or headset and try again.",
          "Check your OS sound settings to confirm an input device is selected.",
        ],
      };
    }
    return {
      ok: false,
      reason: "unknown",
      message: err.message || "Could not access the microphone.",
      troubleshoot: ["Try reloading the page, or use a different browser."],
    };
  }
}
