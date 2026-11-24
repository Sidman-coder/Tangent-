// Turns what a browser throws into words a student can act on. Overnight 4.4
// (device emulation): going offline showed "Failed to fetch" and a denied
// microphone showed "Permission denied". Pure and client-safe.

export const OFFLINE_MESSAGE = "No connection. Check your internet and try again.";
export const MIC_DENIED_MESSAGE = "Tangent can't use the microphone. Allow it in your browser settings, or tap to type instead.";

const NETWORK = /failed to fetch|load failed|networkerror|network request failed|network error|err_internet_disconnected/i;
const MIC = /permission denied|notallowederror|microphone access denied|permission dismissed|notallowed/i;

/** The message to show for a thrown value. Anything that is not a known browser
 *  error passes through unchanged, so server messages written for students stay. */
export function friendlyError(e: unknown, fallback: string): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  return friendlyMessage(raw, fallback);
}

export function friendlyMessage(raw: string, fallback = "Something went wrong."): string {
  const text = raw.trim();
  if (!text) return fallback;
  if (NETWORK.test(text)) return OFFLINE_MESSAGE;
  if (MIC.test(text)) return MIC_DENIED_MESSAGE;
  return text;
}

export const SERVER_FAILURE_MESSAGE = "I couldn't do that right now. Try again in a minute.";

// What an upstream failure looks like when it leaks: JSON, an HTTP status, the
// model provider's name, or billing words. A student should never read these.
const UPSTREAM_LEAK = /[{}]|anthropic|invalid_request|credit balance|api[ _-]?key|\b[45]\d\d\b|\bstack\b|undefined|\bnull\b/i;

/** The sentence the chat shows when the pipeline did not act. A short plain reason
 *  written for students (for example "That date is in the past") is kept; anything
 *  that looks like a raw upstream error is replaced. The full reason is still
 *  logged on the server. Overnight Phase 5: with the API credits empty, the chat
 *  replied "I couldn't do that — Anthropic error: 400 400 {"type":"error"…". */
export function serverFailureMessage(reason: string): string {
  const text = reason.trim().replace(/[.\s]+$/, "");
  if (!text || text.length > 140 || UPSTREAM_LEAK.test(text)) return SERVER_FAILURE_MESSAGE;
  return `I couldn't do that — ${text}.`;
}
