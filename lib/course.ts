// Canvas titles arrive as "Molarity POGIL [Super Chem 2026]" or
// "unit 4 quiz [P7-AP Calculus BC-BARTHOLOMEW]": the course rides in brackets
// at the end, with period codes, years and the teacher's surname mixed in.
// Display splits that into the assignment's own title and a short course chip
// ("Chem", "AP Calc"). Stored titles are never changed.

import type { Task } from "./types";

/** Emoji (surrogate pairs, symbols, variation selectors), without the u flag
 *  the build target doesn't allow. */
const EMOJI = /(?:[\uD83C-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]|\uFE0F)/g;

const COURSE_NAMES: [RegExp, string][] = [
  [/chem/i, "Chem"],
  [/calc/i, "Calc"],
  [/stat/i, "Stats"],
  [/pre-?calc/i, "Precalc"],
  [/alg/i, "Algebra"],
  [/geom/i, "Geometry"],
  [/bio/i, "Bio"],
  [/phys/i, "Physics"],
  [/world/i, "World"],
  [/(?:\bus\b|u\.s\.|american).*hist|apush/i, "US History"],
  [/euro/i, "Euro"],
  [/hist/i, "History"],
  [/lit|english|\blang\b|composition/i, "English"],
  [/span/i, "Spanish"],
  [/fren|fran[cç]/i, "French"],
  [/comp(?:uter)?\s*sci|\bcs\b|\bcsp\b|\bcsa\b|programming/i, "CS"],
  [/macro|micro|econ/i, "Econ"],
  [/psych/i, "Psych"],
  [/gov|civics/i, "Gov"],
  [/orchestra|band|choir|music|string/i, "Music"],
  [/\bart\b|studio|drawing/i, "Art"],
  [/health|\bpe\b|fitness/i, "Health"],
];

/** "P7-AP Calculus BC-BARTHOLOMEW" → "AP Calculus BC". */
export function cleanCourse(raw: string): string {
  return raw
    .replace(/^\s*(?:p(?:er(?:iod)?)?\.?\s*\d+[a-z]?)\s*[-–:]\s*/i, "") // period code
    .replace(/\s*[-–]\s*[A-Z][A-Z'’.]+(?:\s+[A-Z][A-Z'’.]+)*\s*$/, "") // TEACHER SURNAME
    .replace(/\b(?:19|20)\d{2}(?:\s*[-–/]\s*(?:19|20)?\d{2})?\b/g, "") // years
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s\-–:]+|[\s\-–:]+$/g, "")
    .trim();
}

/** A short chip for a cleaned course name. */
export function courseChip(course: string): string {
  // "APCSP", "APCSA": AP Computer Science written as one word.
  if (/\bAP\s*CS[PA]?\b/i.test(course)) return "AP CS";
  const ap = /\bAP\b/.test(course) ? "AP " : "";
  for (const [re, name] of COURSE_NAMES) if (re.test(course)) return ap + name;
  // Real words only: a stray "-" between parts is not a word.
  const words = course
    .replace(/\bAP\b/, "")
    .trim()
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w))
    .slice(0, 2)
    .join(" ");
  return (ap + words).slice(0, 16).trim();
}

/** The assignment title without its bracketed course, and the course chip.
 *  Only Canvas items are split; anything else comes back unchanged. */
export function splitCourse(task: Pick<Task, "title" | "source">): { title: string; course: string | null } {
  if (task.source !== "canvas") return { title: task.title, course: null };
  const m = /^(.*?)\s*\[([^\]]+)\]?\s*$/.exec(task.title);
  if (!m || !m[1].trim()) return { title: task.title, course: null };
  const course = cleanCourse(m[2]);
  return { title: m[1].replace(EMOJI, "").trim(), course: course ? courseChip(course) : null };
}
