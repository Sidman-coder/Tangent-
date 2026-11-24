// Overnight 2 (Jordan sim): "Drafted the club pitch, went fine, took about 20
// min" typed into Home is a report on a step, not new work. Pure: spots the
// report, picks the step it's about, and reads a check-in code from it. The
// chat route logs it like the check-in sheet does (app/api/today "check_in").

import { addDaysYMD } from "./time";
import { topicWords } from "./ai/plan-guard";

/** "went fine", "took me 20 min", "it was easy": how something went. */
const HOW_IT_WENT =
  /\b(?:went (?:fine|well|ok|okay|great|good|alright|badly|bad|rough|terribly|so-so)|it was (?:easy|hard|fine|ok|okay|rough|tough)|took (?:me )?(?:about |around |like |maybe )?(?:\d+|an?|half an?)\s*(?:min|mins|minutes|hours?|hrs?)\b|(?:nailed|crushed|struggled with|got through) it)/i;

/** Future plans say "need to", "tomorrow", "by Friday": never a report. */
const FUTURE = /\b(?:need to|have to|gotta|going to|gonna|will|tomorrow|next week|by (?:mon|tue|wed|thu|fri|sat|sun)\w*|remind me)\b/i;

export function isProgressReport(text: string): boolean {
  const s = text.trim();
  return s.length <= 400 && HOW_IT_WENT.test(s) && !FUTURE.test(s);
}

export type ReportFeel = "nailed" | "okay" | "struggled";

export function reportFeel(text: string): ReportFeel | null {
  if (/\b(?:nailed|crushed|went (?:great|really well)|it was easy|easy)\b/i.test(text)) return "nailed";
  if (/\b(?:struggled|went (?:badly|bad|rough|terribly)|it was (?:hard|rough|tough)|hard|confusing)\b/i.test(text)) return "struggled";
  if (/\b(?:went (?:fine|well|ok|okay|good|alright|so-so)|it was (?:fine|ok|okay))\b/i.test(text)) return "okay";
  return null;
}

type Step = { id: string; title: string; date: string; completed: boolean };

/** Words that say nothing about which step it is. */
const VAGUE = new Set(["went", "fine", "took", "about", "min", "minute", "hour", "done", "did", "finished", "kept", "page", "one", "well", "good", "okay", "ok", "it", "was", "today", "just", "really", "pretty"]);

/**
 * The step the report is about: one dated from two days ago to tomorrow (or
 * already done) that shares the most words with it. Ties go to the one done
 * most recently, then the nearest date. Null when nothing shares a word.
 */
export function reportedStep<T extends Step>(tasks: readonly T[], text: string, today: string): T | null {
  const said = new Set(topicWords(text).filter((w) => !VAGUE.has(w) && w.length >= 3).map(stem));
  if (said.size === 0) return null;
  const from = addDaysYMD(today, -2);
  const to = addDaysYMD(today, 1);
  let best: { t: T; score: number } | null = null;
  for (const t of tasks) {
    if (!t.date || t.date < from || t.date > to) continue;
    const score = topicWords(t.title).map(stem).filter((w) => said.has(w)).length;
    if (score === 0) continue;
    const better =
      !best ||
      score > best.score ||
      (score === best.score && Number(t.completed) > Number(best.t.completed)) ||
      (score === best.score && t.completed === best.t.completed && Math.abs(daysApart(t.date, today)) < Math.abs(daysApart(best.t.date, today)));
    if (better) best = { t, score };
  }
  return best?.t ?? null;
}

/** "drafted"/"draft", "pitches"/"pitch": close enough to match a title. */
function stem(w: string): string {
  return w.replace(/(?:ing|ed|es)$/, "").replace(/e$/, "");
}

function daysApart(a: string, b: string): number {
  return (Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}
