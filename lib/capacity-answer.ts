/** "About 2 hrs" / "90 min" / "4+ hrs" → minutes, or null. Shared by the
 *  question flows on the server and Get to know you in the browser. */
export function capacityFromAnswer(answer: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*\+?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i.exec(answer);
  if (!m) return null;
  const n = Number(m[1]);
  const minutes = /^h/i.test(m[2]) ? n * 60 : n;
  return minutes >= 15 && minutes <= 600 ? Math.round(minutes) : null;
}
