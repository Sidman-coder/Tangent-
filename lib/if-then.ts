// Round 6 (item 4): each step as an if-then plan ("implementation
// intention"). The cue is real because it's built in code from the step's
// final slot, not written by the model: the fixed item (school, a cmt_ block,
// a recurring task) or typed busy time that ends just before the step that
// day, else the step's own time.
//   "When soccer practice ends Tuesday (5:30 PM), then 30 min: wire the motor."
//   "At 7:30 PM Tuesday, then 45 min: wire the motor."
// It rides on the step as a WHEN: note line (lib/note-parts.ts) and shows
// under the title in the brief and in task detail. Pure; safe in the client.

type Item = { label: string; start: number; end: number };
export type IfThenStep = { title: string; date: string; time?: string | null; minutes?: number | null };

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** A cue must end at most this long before the step, or "when it ends, then…" isn't true. */
export const CUE_GAP_MINUTES = 30;

function weekday(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function minutesOf(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? "");
  return m && time !== "23:59" ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/** "Wire the motor" → "wire the motor"; "AP Chem set" and "SAT drill" keep their caps. */
function lowerLead(title: string): string {
  const t = title.trim().replace(/[.!]+$/, "");
  return /^[A-Z][a-z]+\b/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function cueName(label: string): string {
  const l = label.trim();
  if (/^school$/i.test(l)) return "school";
  // "Soccer practice" stays as written; a typed window's label is already lower case ("bakery shift").
  return /^[A-Z][a-z]+\b/.test(l) && !/^[A-Z][a-z]+\s+[A-Z]/.test(l) ? l.charAt(0).toLowerCase() + l.slice(1) : l;
}

/** The item that ends 0–30 min before the step starts that day (the latest one), or null. */
export function cueFor(step: IfThenStep, items: readonly Item[]): Item | null {
  const start = minutesOf(step.time);
  if (start === null) return null;
  const before = items.filter((b) => b.end <= start && start - b.end <= CUE_GAP_MINUTES);
  return before.sort((a, b) => b.end - a.end)[0] ?? null;
}

/** The if-then line for a step at its slot, or "" when the step has no time. */
export function ifThenLine(step: IfThenStep, items: readonly Item[]): string {
  const start = minutesOf(step.time);
  if (start === null) return "";
  const day = weekday(step.date);
  const what = `${step.minutes ? `${step.minutes} min: ` : ""}${lowerLead(step.title)}.`;
  const cue = cueFor(step, items);
  if (cue) {
    const name = cueName(cue.label);
    // "bakery shifts end", "soccer practice ends"
    const verb = /[^s]s$/i.test(name) ? "end" : "ends";
    return `When ${name} ${verb} ${day} (${clock(cue.end)}), then ${what}`;
  }
  return `At ${clock(start)} ${day}, then ${what}`;
}

export type ParsedCue = { kind: "when"; label: string; day: string; end: number } | { kind: "at"; day: string; time: number };

/** Reads the cue back out of a line (for checks and the eval), or null. */
export function parseIfThen(line: string): ParsedCue | null {
  const t = (s: string) => {
    const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(s);
    return m ? ((Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0)) * 60 + Number(m[2]) : null;
  };
  const when = /^When (.+) ends? (\w+day) \((\d{1,2}:\d{2} [AP]M)\), then /.exec(line);
  if (when && t(when[3]) !== null) return { kind: "when", label: when[1], day: when[2], end: t(when[3])! };
  const at = /^At (\d{1,2}:\d{2} [AP]M) (\w+day), then /.exec(line);
  if (at && t(at[1]) !== null) return { kind: "at", day: at[2], time: t(at[1])! };
  return null;
}

/** True when the line's cue still holds for the step's slot (it may have been moved since). */
export function ifThenFits(line: string, step: IfThenStep): boolean {
  const cue = parseIfThen(line);
  const start = minutesOf(step.time);
  if (!cue || start === null || cue.day !== weekday(step.date)) return false;
  return cue.kind === "at" ? cue.time === start : cue.end <= start && start - cue.end <= CUE_GAP_MINUTES;
}

/** The stored line when it still fits the step's slot; otherwise the plain time line for where the step is now. */
export function ifThenFor(stored: string | undefined, step: IfThenStep): string {
  if (stored && ifThenFits(stored, step)) return stored;
  return ifThenLine(step, []);
}

const TAIL = /\s*(?:\s[—–-]\s|[:,;(]|\s(?:for|with|using|before|after|so|from|in order to)\s).*$/i;

/** Titles stay 2–6 words: a longer one loses a trailing clause ("…, then check answers",
 *  "… for the Friday test"), then its articles ("Complete a full practice final" → "Complete
 *  full practice final"). It's never cut mid-phrase; when no clean cut exists, it stays. */
export function shortTitle(title: string): string {
  const t = title.trim().replace(/\s+/g, " ");
  const count = (s: string) => s.split(" ").filter(Boolean).length;
  const fits = (s: string) => count(s) >= 2 && count(s) <= 6;
  if (count(t) <= 6) return t;
  const noArticles = (s: string) => s.replace(/(?<=\S) (?:a|an|the)(?= )/gi, "");
  for (const cut of [t.replace(TAIL, "").trim(), noArticles(t), noArticles(t.replace(TAIL, "").trim())]) {
    if (fits(cut)) return cut;
  }
  return t;
}
