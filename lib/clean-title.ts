// What a task's title should read as in a list: the work itself, without the
// bracketed course/teacher/section suffix Canvas adds, without the project's
// name repeated in front ("Robotics: Wire the arm motor" under the Robotics
// header), and without a trailing period. Display only: stored titles never
// change, and task detail shows the original. Never returns an empty title.

import { cleanCourse, courseChip } from "./course";

/** Emoji, without the u flag the build target doesn't allow. */
const EMOJI = /(?:[\uD83C-\uDBFF][\uDC00-\uDFFF]|[☀-➿]|️)/g;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type CleanTitleOptions = {
  /** The task's project title; a leading "Project: " or "Project – " is dropped. */
  projectName?: string | null;
  /** A trailing [Course]: "chip" splits it into a course chip (Canvas items,
   *  the default), "drop" removes it, "keep" leaves the title as written. */
  course?: "chip" | "drop" | "keep";
};

export function cleanTaskTitle(raw: string, options: CleanTitleOptions = {}): { title: string; course: string | null } {
  const original = raw.replace(/\s+/g, " ").trim();
  let title = original;
  let course: string | null = null;

  // "Molarity POGIL [P7-AP Chem-SMITH]" → "Molarity POGIL" + "AP Chem"
  const bracket = /^(.*?)\s*\[([^\]]+)\]?\s*$/.exec(title);
  const mode = options.course ?? "chip";
  if (mode !== "keep" && bracket && bracket[1].trim()) {
    title = bracket[1];
    if (mode === "chip") {
      const cleaned = cleanCourse(bracket[2]);
      course = cleaned ? courseChip(cleaned) : null;
    }
  }

  const project = options.projectName?.replace(/\s+/g, " ").trim();
  if (project) {
    // "Robotics: …", "Robotics - …", "Robotics — …", "Robotics | …", "[Robotics] …"
    const name = escapeRe(project);
    const prefix = new RegExp(`^(?:${name}\\s*[:|\\-–—]\\s*|\\[${name}\\]\\s*(?:[:|\\-–—]\\s*)?)`, "i");
    const stripped = title.replace(prefix, "");
    if (stripped.trim()) title = stripped;
    // "… (Robotics)" or "… for Robotics" at the end
    const suffix = new RegExp(`\\s*(?:\\(${escapeRe(project)}\\)|[-–—]\\s*${escapeRe(project)})\\s*$`, "i");
    const trimmed = title.replace(suffix, "");
    if (trimmed.trim()) title = trimmed;
  }

  title = title
    .replace(EMOJI, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*\.+$/, "") // trailing period, not "…" or "?"
    .trim();

  if (title && title[0] !== title[0].toUpperCase() && /^[a-z]/.test(title)) {
    title = title[0].toUpperCase() + title.slice(1);
  }

  return { title: title || original || raw, course };
}
