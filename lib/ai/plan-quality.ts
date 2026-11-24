// Round 5A 2.4: grading for the plan-quality eval (lib/pipeline/fixtures/
// plan-quality.json, run by `npm run eval:pipeline -- --quality`). Pure, so the
// fixture file and the grader are checked for free in `npm test`.

import type { GuardConfig, GuardStep, checkStep as CheckStep, bannedPhraseIn as BannedPhraseIn } from "./plan-guard";
import type { PlacementCase } from "./placement-grade";

/** The guard's checks, passed in so this file has no runtime imports (plain `node --test`). */
export type GuardFns = { checkStep: typeof CheckStep; bannedPhraseIn: typeof BannedPhraseIn };

export type QualityCase = {
  id: string;
  request: string;
  weekSummary: string;
  dates: string[];
  facts: { id: string; text: string }[];
  topicWords: string[];
  minTopicSteps: number;
} & Partial<Pick<PlacementCase, "times" | "reference_date" | "school" | "expectDeadline" | "expectBusy">>;

export type QualityFile = { version: 1; reference_date: string; timezone: string; note?: string; cases: QualityCase[] };

const isYmd = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isStr = (s: unknown) => typeof s === "string" && s.trim().length > 0;

/** Checks the fixture file's shape; returns problems, or [] when it's valid. */
export function validateQualityFile(raw: unknown): string[] {
  const out: string[] = [];
  const f = raw as Partial<QualityFile> | null;
  if (!f || f.version !== 1) return ["version must be 1"];
  if (!isYmd(f.reference_date)) out.push("reference_date must be YYYY-MM-DD");
  if (!isStr(f.timezone)) out.push("timezone missing");
  if (!Array.isArray(f.cases) || f.cases.length === 0) return [...out, "cases must be a non-empty array"];
  const ids = new Set<string>();
  for (const c of f.cases) {
    const at = `case ${c?.id ?? "?"}`;
    if (!isStr(c?.id)) out.push(`${at}: id missing`);
    else if (ids.has(c.id)) out.push(`${at}: duplicate id`);
    else ids.add(c.id);
    if (!isStr(c?.request)) out.push(`${at}: request missing`);
    if (typeof c?.weekSummary !== "string") out.push(`${at}: weekSummary missing`);
    if (!Array.isArray(c?.dates) || c.dates.length === 0 || !c.dates.every(isYmd)) out.push(`${at}: dates must be YYYY-MM-DD`);
    if (!Array.isArray(c?.facts) || !c.facts.every((x) => isStr(x?.id) && isStr(x?.text))) out.push(`${at}: facts must be {id, text}`);
    if (!Array.isArray(c?.topicWords) || c.topicWords.length === 0 || !c.topicWords.every(isStr)) out.push(`${at}: topicWords missing`);
    if (c?.times !== undefined && (!Array.isArray(c.times) || c.times.length !== c.dates?.length || !c.times.every((t) => /^\d{2}:\d{2}$/.test(t)))) {
      out.push(`${at}: times must be HH:MM, one per date`);
    }
    if (c?.reference_date !== undefined && !isYmd(c.reference_date)) out.push(`${at}: reference_date must be YYYY-MM-DD`);
    if (!Number.isInteger(c?.minTopicSteps) || c.minTopicSteps < 1 || (Array.isArray(c?.dates) && c.minTopicSteps > c.dates.length)) {
      out.push(`${at}: minTopicSteps must be 1..dates.length`);
    }
  }
  return out;
}

const mentions = (text: string, words: readonly string[]) => {
  const hay = ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  return words.some((w) => hay.includes(` ${w.toLowerCase()}`));
};

export type QualityGrade = { pass: boolean; failures: string[] };

/** Grades one brief's output against its case. */
export function gradePlanQuality(
  c: QualityCase,
  brief: { goal_line: string; steps: (GuardStep & { youll_have?: string })[] } | null,
  cfg: GuardConfig,
  { checkStep, bannedPhraseIn }: GuardFns
): QualityGrade {
  if (!brief) return { pass: false, failures: ["no brief (the call failed)"] };
  const failures: string[] = [];
  if (brief.steps.length === 0) failures.push("no steps kept");
  if (!mentions(brief.goal_line, c.topicWords)) failures.push(`goal line doesn't name the topic: "${brief.goal_line}"`);
  const ctx = { factIds: c.facts.map((f) => f.id), dates: c.dates, topicText: `${c.request} ${brief.goal_line}` };
  brief.steps.forEach((s, i) => {
    const r = checkStep(s, ctx, cfg);
    if (!r.ok) failures.push(`step ${i + 1} fails the guard (${r.reason}: ${r.detail})`);
    const banned = s.youll_have ? bannedPhraseIn(s.youll_have, cfg) : null;
    if (banned) failures.push(`step ${i + 1} result uses "${banned}"`);
  });
  const topical = brief.steps.filter((s) => mentions(`${s.what} ${s.youll_have ?? ""}`, c.topicWords)).length;
  if (topical < Math.min(c.minTopicSteps, Math.max(1, brief.steps.length))) {
    failures.push(`only ${topical} step(s) name the topic; want ${c.minTopicSteps}`);
  }
  return { pass: failures.length === 0, failures };
}
