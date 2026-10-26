// What the capture home shows while you talk. The streamed transcript
// (Deepgram, via useVoiceCapture's onPartial) is the real one; when it isn't
// available, the browser's own speech recognition gives a preview. Display
// only: what gets saved always comes from the recording.

export function liveCaption(streamed: string, browser: string): string {
  return streamed.trim() ? streamed : browser.trim() ? browser : "";
}

/** iOS shares one audio session: recognition alongside the recording can stop it. */
export function browserCaptionAllowed(nav: { userAgent: string; maxTouchPoints: number }): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return false;
  if (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1) return false;
  return true;
}
