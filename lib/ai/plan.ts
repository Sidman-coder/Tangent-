import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { callClaude, messageText, streamClaude, type ClaudeResult } from "@/lib/ai/call";
import { addDaysYMD, daysBetweenYMD } from "@/lib/time";
import type { Tier } from "@/lib/ai/models";

// Two-stage plan generation.
//
//   1. OUTLINE (SMART, ≤300 output tokens): a title and one name + goal per
//      phase. This is where the progression is decided, so it stays on SMART.
//   2. DETAIL (FAST by default), one call per phase, all in parallel and
//      streamed: each writes the sessions for its own fixed dates.
//
// The server owns the dates: it computes every session slot up front and each
// phase gets an exact list, so the model can't drift off the range or collide
// sessions. Tasks are reported through onTask as soon as each one is complete
// in a stream, so the UI can show them while the rest are still being written.
// Nothing is saved here; the caller inserts the finished plan in one go.
//
// Measured against one streamed SMART call on 2026-09-27 (docs/tangent/perf-after.md):
// the single call's total grows with plan length (12 s for 7 tasks, 31 s for 30);
// the two-stage total stays near outline + one phase (8–13 s).

export type PlanTask = {
  title: string;
  date: string;
  time: string;
  calendarId: "cal_work" | "cal_personal" | "cal_study" | "cal_all";
  notes: string;
  startAction: string;
  resources: { label: string; url: string }[];
};

export type PlanPhase = { name: string; goal: string };

export type GeneratedPlan =
  | { ok: true; title: string; phases: PlanPhase[]; tasks: PlanTask[] }
  | { ok: false; error: string; budgetExceeded?: boolean };

const CALENDAR_IDS = ["cal_work", "cal_personal", "cal_study", "cal_all"] as const;

const TASK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    time: { type: "string" },
    calendarId: { type: "string", enum: CALENDAR_IDS },
    notes: { type: "string" },
    startAction: { type: "string" },
    resources: {
      type: "array",
      items: {
        type: "object",
        properties: { label: { type: "string" }, url: { type: "string" } },
        required: ["label", "url"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "time", "calendarId", "notes", "startAction", "resources"],
  additionalProperties: false,
} as const;

const OUTLINE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    phases: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, goal: { type: "string" } },
        required: ["name", "goal"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "phases"],
  additionalProperties: false,
} as const;

const DETAIL_SCHEMA = {
  type: "object",
  properties: { tasks: { type: "array", items: TASK_SCHEMA } },
  required: ["tasks"],
  additionalProperties: false,
} as const;

const TASK_RULES = `Each task:
- title: under 7 words, specific to this session.
- time: HH:MM between 07:00 and 20:00; vary it sensibly.
- calendarId: cal_study for school and learning, cal_personal for health, hobbies and life, cal_work for jobs and projects, cal_all if unclear.
- notes: ONE sentence saying exactly what to work on and how, specific to the topic. No URLs.
- startAction: one concrete thing to do in the first 2 minutes, under 20 words, starting with a verb (Watch, Read, Open, Solve, Write, Review, Draft).
- resources: 0 to 2 links, only when a specific page genuinely helps this session AND you are certain the exact URL exists (well-known sites such as Khan Academy, YouTube, Coursera, MIT OpenCourseWare, Lichess, Codecademy). Otherwise an empty array. Never homepages or search-result URLs.
Sessions must build on each other; no two alike.`;

// ─── Dates ───────────────────────────────────────────────────────────────────

/** Session spacing for a plan length: daily up to two weeks, then sparser so
 *  long plans don't flood the calendar. */
export function sessionInterval(dayCount: number): number {
  if (dayCount <= 14) return 1;
  if (dayCount <= 30) return 2;
  if (dayCount <= 90) return 3;
  if (dayCount <= 180) return 5;
  return 7;
}

/** Every session date from start to end (inclusive), spaced by sessionInterval. */
export function planDates(startDate: string, endDate: string): string[] {
  const dayCount = Math.max(1, daysBetweenYMD(startDate, endDate) + 1);
  const interval = sessionInterval(dayCount);
  const count = Math.ceil(dayCount / interval);
  return Array.from({ length: count }, (_, i) => addDaysYMD(startDate, i * interval));
}

/** Sessions per phase: 1 phase up to 4 sessions, then 2, 3, and at most 4
 *  phases, sized as evenly as possible (earlier phases take the remainder). */
export function phaseSizes(n: number): number[] {
  if (n <= 0) return [];
  const phases = n <= 4 ? 1 : n <= 8 ? 2 : n <= 15 ? 3 : 4;
  const base = Math.floor(n / phases);
  const extra = n % phases;
  return Array.from({ length: phases }, (_, i) => base + (i < extra ? 1 : 0));
}

// ─── Streaming parser ────────────────────────────────────────────────────────

/** The complete objects in the first "tasks" array of a partial JSON text.
 *  Tolerates a truncated tail, so it can run after every stream delta. */
export function completeTasks(text: string): unknown[] {
  const key = text.indexOf('"tasks"');
  if (key < 0) return [];
  const open = text.indexOf("[", key);
  if (open < 0) return [];
  const out: unknown[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let start = -1;
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(text.slice(start, i + 1)));
        } catch {
          // Unparseable object: skip it; validation counts what's missing.
        }
        start = -1;
      }
    } else if (c === "]" && depth === 0) break;
  }
  return out;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const clip = (s: unknown, max: number): string => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

function isUsefulUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    // Homepages and search pages aren't a specific resource.
    if (u.pathname === "/" || u.pathname === "") return false;
    if (/\/(results|search)\b/i.test(u.pathname) || u.searchParams.has("search_query")) return false;
    return true;
  } catch {
    return false;
  }
}

/** Server-side clean-up of one model task. The date always comes from the
 *  slot, never the model. Returns null when there's no usable title. */
export function normalizeTask(raw: unknown, date: string): PlanTask | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const title = clip(t.title, 80);
  if (!title) return null;
  const time = typeof t.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.time.trim()) ? t.time.trim() : "09:00";
  const calendarId = CALENDAR_IDS.includes(t.calendarId as PlanTask["calendarId"]) ? (t.calendarId as PlanTask["calendarId"]) : "cal_all";
  const resources = (Array.isArray(t.resources) ? t.resources : [])
    .map((r) => (r && typeof r === "object" ? (r as Record<string, unknown>) : {}))
    .map((r) => ({ label: clip(r.label, 120), url: clip(r.url, 500) }))
    .filter((r) => r.label && isUsefulUrl(r.url))
    .slice(0, 2);
  return { title, date, time, calendarId, notes: clip(t.notes, 400), startAction: clip(t.startAction, 160), resources };
}

// ─── Generation ──────────────────────────────────────────────────────────────

export type GeneratePlanInput = {
  /** What the student asked for, with any earlier conversation appended. */
  request: string;
  /** "Today is …" line(s) for the prompt. */
  dateContext: string;
  /** Session dates from planDates(). */
  dates: string[];
  onOutline?: (outline: { title: string; phases: PlanPhase[]; taskCount: number }) => void;
  /** Called as each task completes. `index` is the task's slot; a retried
   *  phase re-reports its slots, so treat it as an upsert. */
  onTask?: (index: number, task: PlanTask) => void;
};

function detailTier(): Tier | undefined {
  return process.env.AI_PLAN_DETAIL_TIER?.trim().toUpperCase() === "SMART" ? "SMART" : undefined;
}

function failed(r: Extract<ClaudeResult, { ok: false }>): GeneratedPlan {
  return { ok: false, error: r.error, budgetExceeded: r.budgetExceeded };
}

async function outline(input: GeneratePlanInput, sizes: number[]): Promise<{ title: string; phases: PlanPhase[] } | GeneratedPlan> {
  const { dates } = input;
  const system = `You outline study and practice plans for a student's calendar.
${input.dateContext}
The plan has ${dates.length} session${dates.length > 1 ? "s" : ""} from ${dates[0]} to ${dates[dates.length - 1]}, split into exactly ${sizes.length} phase${sizes.length > 1 ? "s" : ""} of ${sizes.join(", ")} session${dates.length > 1 ? "s" : ""}.
Return a title (2 to 6 words, specific to the goal, e.g. "Chess Tactics Fundamentals"; never "New Plan" or "Study Plan") and, for each phase in order, a short name and a one-sentence goal. Phases progress from foundations to harder work.`;
  let last: GeneratedPlan = { ok: false, error: "Outline failed" };
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await callClaude(
      "planOutline",
      { system, messages: [{ role: "user", content: `Request: ${input.request}` }] },
      { format: { type: "json_schema", schema: OUTLINE_SCHEMA } as Anthropic.JSONOutputFormat, label: "plan outline" }
    );
    if (!r.ok) {
      if (r.budgetExceeded) return failed(r);
      last = failed(r);
      continue;
    }
    try {
      const json = JSON.parse(messageText(r.message)) as { title?: unknown; phases?: unknown };
      const title = clip(json.title, 60);
      const phases = (Array.isArray(json.phases) ? json.phases : [])
        .map((p) => (p && typeof p === "object" ? (p as Record<string, unknown>) : {}))
        .map((p) => ({ name: clip(p.name, 60), goal: clip(p.goal, 200) }));
      // A blank title is fine: callers fall back to the student's words (resolvePlanTitle).
      if (phases.length === 0) throw new Error("empty outline");
      // Pad or trim to the phase count the server chose.
      const fixed = sizes.map((_, i) => phases[i] ?? { name: `Part ${i + 1}`, goal: phases[phases.length - 1].goal });
      return { title, phases: fixed };
    } catch (e) {
      last = { ok: false, error: `Outline unreadable: ${e instanceof Error ? e.message : e}` };
    }
  }
  return last;
}

async function detail(
  input: GeneratePlanInput,
  plan: { title: string; phases: PlanPhase[] },
  phase: number,
  offset: number,
  dates: string[]
): Promise<{ tasks: (PlanTask | null)[] } | GeneratedPlan> {
  const ph = plan.phases[phase];
  const system = `You write the sessions of one phase of a student's plan.
${input.dateContext}
Plan: "${plan.title}". Phases: ${plan.phases.map((p, j) => `${j + 1}. ${p.name}: ${p.goal}`).join(" ")}
Write phase ${phase + 1} (${ph.name}): exactly ${dates.length} task${dates.length > 1 ? "s" : ""}, one for each of these dates, in order: ${dates.join(", ")}.

${TASK_RULES}`;
  const run = async (tier: Tier | undefined, route: string | undefined) => {
    const tasks: (PlanTask | null)[] = dates.map(() => null);
    let seen = 0;
    const r = await streamClaude(
      "planDetail",
      { system, messages: [{ role: "user", content: `Request: ${input.request}` }] },
      {
        format: { type: "json_schema", schema: DETAIL_SCHEMA } as Anthropic.JSONOutputFormat,
        tier,
        route,
        label: `plan detail ${phase + 1}`,
        onText: (text) => {
          const done = completeTasks(text);
          for (; seen < done.length && seen < dates.length; seen++) {
            const task = normalizeTask(done[seen], dates[seen]);
            tasks[seen] = task;
            if (task) input.onTask?.(offset + seen, task);
          }
        },
      }
    );
    if (!r.ok) return { result: r, tasks };
    // The final text is authoritative (the stream parser may have skipped a tail object).
    let final: unknown[] = [];
    try {
      final = (JSON.parse(messageText(r.message)) as { tasks?: unknown[] }).tasks ?? [];
    } catch {
      final = completeTasks(messageText(r.message));
    }
    for (let i = 0; i < dates.length; i++) {
      const task = normalizeTask(final[i], dates[i]);
      if (task && !tasks[i]) input.onTask?.(offset + i, task);
      tasks[i] = task ?? tasks[i];
    }
    return { result: r, tasks };
  };

  let attempt = await run(detailTier(), undefined);
  if (!attempt.result.ok && attempt.result.budgetExceeded) return failed(attempt.result);
  if (!attempt.result.ok || attempt.tasks.some((t) => !t)) {
    // Short or failed phase: one retry on SMART, logged as an escalation.
    const retry = await run("SMART", "plan:detail-retry-smart");
    if (!retry.result.ok && retry.result.budgetExceeded) return failed(retry.result);
    // Keep whichever attempt produced more usable sessions.
    const count = (x: typeof attempt) => x.tasks.filter(Boolean).length;
    if (count(retry) >= count(attempt)) attempt = retry;
  }
  if (!attempt.tasks.some(Boolean)) {
    return { ok: false, error: attempt.result.ok ? "Phase came back empty" : attempt.result.error };
  }
  return { tasks: attempt.tasks };
}

/** Outline, then all phases in parallel. Never throws for API errors. */
export async function generatePlan(input: GeneratePlanInput): Promise<GeneratedPlan> {
  const sizes = phaseSizes(input.dates.length);
  if (sizes.length === 0) return { ok: false, error: "No session dates" };
  const o = await outline(input, sizes);
  if ("ok" in o) return o;
  input.onOutline?.({ title: o.title, phases: o.phases, taskCount: input.dates.length });

  let offset = 0;
  const jobs = sizes.map((size, i) => {
    const start = offset;
    offset += size;
    return detail(input, o, i, start, input.dates.slice(start, start + size));
  });
  const results = await Promise.all(jobs);
  const tasks: PlanTask[] = [];
  for (const r of results) {
    if ("ok" in r) return r;
    for (const t of r.tasks) if (t) tasks.push(t);
  }
  return { ok: true, title: o.title, phases: o.phases, tasks };
}

// ─── Routing ─────────────────────────────────────────────────────────────────

const PLAN_PHRASES = [
  /\bhelp me\b/,
  /\bget (better|good) at\b/,
  /\bplan for\b/,
  /\b(\d+|a|one|two|three|four|five|six)[- ]weeks?\b/,
  /\bstart my\b/,
];
// Requests about existing tasks, questions, and one-off items with a set day or
// time aren't plans even when they contain a plan phrase ("help me move my
// essay to Friday", "start my essay tomorrow at 4pm").
const NOT_A_PLAN =
  /\b(delete|remove|cancel|move|reschedule|push|mark|done|finished|completed?|undo|remind|rename|what|when|which|show|list)\b|\b(today|tonight|tomorrow)\b|\b\d{1,2}(:\d\d)?\s*(am|pm)\b|\bat \d{1,2}(:\d\d)?\b/;

/** A request that clearly asks for a multi-session plan, so the voice pipeline
 *  can skip the classifier call and go straight to plan generation. */
export function isClearPlanRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return !NOT_A_PLAN.test(lower) && PLAN_PHRASES.some((re) => re.test(lower));
}
