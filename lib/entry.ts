// The capture home (/capture) is the first screen each time the app is opened.
// It sets this session cookie (no expiry, so it ends with the browser session);
// app/(app)/page.tsx sends a visit to / without it to /capture first.
export const ENTERED_COOKIE = "tg_entered";

/** Client-only: mark this browser session as having passed the capture home. */
export function markEntered(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ENTERED_COOKIE}=1; path=/; SameSite=Lax`;
}
