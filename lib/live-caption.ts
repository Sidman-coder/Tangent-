// What the capture home shows while you talk. The streamed transcript
// (Deepgram, via useVoiceCapture's onPartial) is the real one; when it isn't
// available, the browser's own speech recognition gives a preview. Display
// only: what gets saved always comes from the recording.

export function liveCaption(streamed: string, browser: string): string {
  return streamed.trim() ? streamed : browser.trim() ? browser : "";
}

/** The caption word by word. Interim words are the stream's guess so far and
 *  can still change; a browser caption is only ever a preview. */
export function captionWords(streamed: string, interim: string, browser: string): { word: string; interim: boolean }[] {
  const split = (s: string) => s.split(/\s+/).filter(Boolean);
  if (!streamed.trim()) return split(browser).map((word) => ({ word, interim: true }));
  const words = split(streamed);
  const settled = words.length - split(interim).length;
  return words.map((word, i) => ({ word, interim: i >= settled }));
}

/** iOS shares one audio session: recognition alongside the recording can stop it. */
export function browserCaptionAllowed(nav: { userAgent: string; maxTouchPoints: number }): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return false;
  if (/Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1) return false;
  return true;
}
