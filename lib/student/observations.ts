// Layer 2 of the context engine: what Tangent sees the student do, and the
// three numbers it learns from it. Pure. Rows live in `step_events`
// (lib/student/step-events.ts writes them); only what these numbers need is kept:
// the kind, the local hour and weekday, the step's estimate, and a short code.

export const STEP_EVENT_KINDS = ["created", "done", "skipped", "not_today", "too_big", "rescheduled", "check_in"] as const;
/** Round 4 behaviour kinds (20261111000000_step_events_behaviour.sql): how the
 *  student plans and asks. Codes only, like the rest. */
export const BEHAVIOUR_EVENT_KINDS = ["chat_ask", "plan_accept", "plan_edit", "plan_reject", "plan_stop", "question_answer", "question_skip"] as const;
export type StepEventKind = (typeof STEP_EVENT_KINDS)[number] | (typeof BEHAVIOUR_EVENT_KINDS)[number];
const ALL_KINDS: readonly string[] = [...STEP_EVENT_KINDS, ...BEHAVIOUR_EVENT_KINDS];

export function isBehaviourKind(kind: StepEventKind): boolean {
  return (BEHAVIOUR_EVENT_KINDS as readonly string[]).includes(kind);
}

/** "Not today" reasons: codes, never free text. */
export const NOT_TODAY_REASONS = ["no_time", "too_tired", "not_ready", "forgot", "unclear", "not_feeling_it", "blocked", "other"] as const;
export type NotTodayReason = (typeof NOT_TODAY_REASONS)[number];

/** A check-in's answer to "How long did that take?" */
export const CHECK_IN_ANSWERS = ["faster", "about_right", "longer", "much_longer"] as const;
export type CheckInAnswer = (typeof CHECK_IN_ANSWERS)[number];
const CHECK_IN_RATIO: Record<CheckInAnswer, number> = { faster: 0.75, about_right: 1, longer: 1.5, much_longer: 2 };

export type StepEvent = {
  kind: StepEventKind;
  /** 0–23 in the student's own timezone. */
  hour: number | null;
  /** 0 = Sunday. */
  weekday: number | null;
  /** The step's estimate when it happened. */
  minutes: number | null;
  /** How long it really took, when Tangent knows (a timer). */
  actualMinutes: number | null;
  /** not_today: a NotTodayReason. check_in: a CheckInAnswer. */
  code: string | null;
};

export function isStepEventKind(v: unknown): v is StepEventKind {
  return typeof v === "string" && ALL_KINDS.includes(v);
}

/** Below this many samples a number is a guess, so Tangent doesn't use it. */
export const MIN_SAMPLES = 3;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number, step: number) => Math.round(n / step) * step;

export type Calibration<T> = { value: T; samples: number };

/**
 * How much longer (or shorter) steps take than planned: the median of
 * actual ÷ estimate. 1 until there are enough samples. Clamped to 0.5–2.5 so
 * one bad week can't wreck every plan.
 */
export function timeMultiplier(events: StepEvent[]): Calibration<number> {
  const ratios: number[] = [];
  for (const e of events) {
    if (e.kind === "done" && e.minutes && e.minutes > 0 && e.actualMinutes && e.actualMinutes > 0) {
      ratios.push(e.actualMinutes / e.minutes);
    } else if (e.kind === "check_in" && e.code && e.code in CHECK_IN_RATIO) {
      ratios.push(CHECK_IN_RATIO[e.code as CheckInAnswer]);
    }
  }
  if (ratios.length < MIN_SAMPLES) return { value: 1, samples: ratios.length };
  return { value: Math.round(clamp(median(ratios), 0.5, 2.5) * 100) / 100, samples: ratios.length };
}

export type HourProfile = {
  /** Steps done in each local hour, 0–23. */
  done: number[];
  /** Hours where at least a fifth of the work gets done, best first. Empty
   *  until there are enough done steps to say. */
  best: number[];
};

/** When the student actually finishes things. */
export function completionByHour(events: StepEvent[], minDone = 5): Calibration<HourProfile> {
  const done = Array.from({ length: 24 }, () => 0);
  let total = 0;
  for (const e of events) {
    if (e.kind !== "done" || e.hour === null || e.hour < 0 || e.hour > 23) continue;
    done[e.hour]++;
    total++;
  }
  // A two-hour window smooths "9:58 vs 10:02".
  const windowed = done.map((n, h) => n + (done[(h + 1) % 24] ?? 0));
  const best =
    total < minDone
      ? []
      : windowed
          .map((n, h) => ({ h, n }))
          .filter((x) => done[x.h] > 0 && x.n / total >= 0.2)
          .sort((a, b) => b.n - a.n || a.h - b.h)
          .slice(0, 3)
          .map((x) => x.h);
  return { value: { done, best }, samples: total };
}

/**
 * The step size the student actually finishes, in minutes: the median
 * estimate of done steps, made smaller when they often say a step is too big
 * or push it to another day. Null until there's enough to go on.
 */
export function preferredStepSize(events: StepEvent[]): Calibration<number | null> {
  const doneSizes = events.filter((e) => e.kind === "done" && e.minutes && e.minutes > 0).map((e) => e.minutes as number);
  const tooBig = events.filter((e) => e.kind === "too_big").length;
  const notToday = events.filter((e) => e.kind === "not_today" && (e.code === "no_time" || e.code === "too_tired")).length;
  if (doneSizes.length < MIN_SAMPLES + 2) return { value: null, samples: doneSizes.length };
  let size = median(doneSizes);
  const pushedBack = (tooBig + notToday * 0.5) / (doneSizes.length + tooBig);
  if (pushedBack >= 0.4) size *= 0.6;
  else if (pushedBack >= 0.2) size *= 0.75;
  return { value: clamp(round(size, 5), 10, 90), samples: doneSizes.length };
}

/** "9pm" for 21. */
export function hourLabel(h: number): string {
  const suffix = h < 12 ? "am" : "pm";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}${suffix}`;
}

/** A short stored code from a slot key or intent: "hoursPerWeek" → "hours_per_week". */
export function toCode(raw: string): string | null {
  const c = raw.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase().replace(/[^a-z_]/g, "").slice(0, 24);
  return c || null;
}

/** What a task-chat question is after, from its words. Only the code is
 *  stored, never the question. */
export const ASK_TYPES = ["how_to", "explain", "check", "stuck", "time", "motivation", "other"] as const;
export type AskType = (typeof ASK_TYPES)[number];

export function classifyAsk(text: string): AskType {
  const t = text.toLowerCase();
  if (/\b(stuck|lost|confus|don'?t (get|understand)|no idea|makes? no sense)/.test(t)) return "stuck";
  if (/\b(can'?t (focus|start|get myself)|procrastinat|motivat|don'?t (want|feel like)|overwhelm|lazy)/.test(t)) return "motivation";
  if (/\b(how long|how much time|when should|enough time|by when)/.test(t)) return "time";
  if (/\b(is (this|it|my)\b.*\b(right|good|correct|ok(ay)?)\b|check (this|my)|review|look over|did i)/.test(t)) return "check";
  if (/\b(how (do|should|can) i|how to|where (do|should) i start|first step|what('?s| is) the first|steps? to)/.test(t)) return "how_to";
  if (/\b(what (is|are|does)|explain|why|meaning of|difference between)/.test(t)) return "explain";
  return "other";
}

const ASK_ADVICE: Record<Exclude<AskType, "other">, string> = {
  how_to: "how to start or do a step. Lead with a concrete first move",
  explain: "what something means. Give short plain explanations with an example",
  check: "whether their work is right. Offer a quick checklist they can use themselves",
  stuck: "help when they're stuck. Break the next move down smaller",
  time: "how long things take. Give time estimates up front",
  motivation: "getting themselves to start. Suggest a 10-minute version of the step",
};

/** Of the steps that came due, how many they finished (done ÷ done + skipped
 *  + "Not today"), and the reason they give most for putting one off. */
export function followThrough(events: StepEvent[]): Calibration<{ rate: number; topReason: string | null }> {
  const done = events.filter((e) => e.kind === "done").length;
  const missed = events.filter((e) => e.kind === "skipped" || e.kind === "not_today").length;
  const total = done + missed;
  const reasons = new Map<string, number>();
  for (const e of events) if (e.kind === "not_today" && e.code && e.code !== "other") reasons.set(e.code, (reasons.get(e.code) ?? 0) + 1);
  const top = Array.from(reasons.entries()).sort((a, b) => b[1] - a[1])[0];
  return { value: { rate: total ? done / total : 0, topReason: top && top[1] >= 2 ? top[0] : null }, samples: total };
}

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The weekdays they actually get work done, best first. */
export function workDays(events: StepEvent[], minDone = 8): Calibration<{ best: number[]; weekendShare: number }> {
  const byDay = Array.from({ length: 7 }, () => 0);
  let total = 0;
  for (const e of events) {
    if (e.kind !== "done" || e.weekday === null || e.weekday < 0 || e.weekday > 6) continue;
    byDay[e.weekday]++;
    total++;
  }
  if (total < minDone) return { value: { best: [], weekendShare: 0 }, samples: total };
  const best = byDay
    .map((n, d) => ({ d, n }))
    .filter((x) => x.n / total >= 0.2)
    .sort((a, b) => b.n - a.n || a.d - b.d)
    .slice(0, 2)
    .map((x) => x.d);
  return { value: { best, weekendShare: (byDay[0] + byDay[6]) / total }, samples: total };
}

/** How they plan with Tangent: do they take plans as they are, change them or
 *  turn them down, and do they answer the questions or skip them. */
export function planningStyle(events: StepEvent[]): Calibration<{ accept: number; edit: number; reject: number; answerRate: number | null; stops: number }> {
  const n = (k: StepEventKind) => events.filter((e) => e.kind === k).length;
  const accept = n("plan_accept");
  const edit = n("plan_edit");
  const reject = n("plan_reject");
  const answered = n("question_answer");
  const asked = answered + n("question_skip");
  return {
    value: { accept, edit, reject, answerRate: asked >= 4 ? answered / asked : null, stops: n("plan_stop") },
    samples: accept + reject,
  };
}

/** What they most often ask about in a task chat. */
export function askPattern(events: StepEvent[]): Calibration<AskType | null> {
  const counts = new Map<AskType, number>();
  let total = 0;
  for (const e of events) {
    if (e.kind !== "chat_ask" || !e.code || !(ASK_TYPES as readonly string[]).includes(e.code)) continue;
    total++;
    if (e.code !== "other") counts.set(e.code as AskType, (counts.get(e.code as AskType) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return { value: top && top[1] >= 3 && top[1] / total >= 0.3 ? top[0] : null, samples: total };
}

const REASON_WORDS: Record<string, string> = { no_time: "no time", too_tired: "too tired", not_ready: "not ready", forgot: "forgot", unclear: "unclear", not_feeling_it: "not feeling it", blocked: "blocked" };

/** How the student behaves, in plain words for the AI. Empty while unsure. */
export function behaviourLines(events: StepEvent[]): string[] {
  const out: string[] = [];
  const f = followThrough(events);
  if (f.samples >= 6) {
    const tail = f.value.rate < 0.5 ? " Keep rounds small and easy to start." : f.value.rate >= 0.8 ? " They can take a full round." : "";
    out.push(`They finish about ${Math.round(f.value.rate * 10)} in 10 of the steps that come due (from ${f.samples}).${tail}`);
    if (f.value.topReason) out.push(`When they put a step off, the usual reason is "${REASON_WORDS[f.value.topReason] ?? f.value.topReason}".`);
  }
  const days = workDays(events);
  if (days.value.best.length) {
    const share = days.value.weekendShare;
    const weekend = share >= 0.4 ? " A lot of their work happens on weekends." : share <= 0.1 ? " They rarely work on weekends." : "";
    out.push(`They get the most done on ${days.value.best.map((d) => DAY[d]).join(" and ")}.${weekend}`);
  }
  const p = planningStyle(events);
  if (p.samples >= 3) {
    const changed = (p.value.edit + p.value.reject) / Math.max(1, p.value.accept + p.value.reject);
    if (changed >= 0.5) out.push("They often change or turn down plans. Offer a choice of two shapes and ask before filling the week.");
    else if (p.value.edit === 0 && p.value.reject === 0) out.push("They usually take plans as they are.");
  }
  if (p.value.answerRate !== null) {
    if (p.value.answerRate < 0.4) out.push("They skip most planning questions. Ask only the one that matters most and assume the rest.");
    else if (p.value.answerRate >= 0.85) out.push("They answer planning questions fully; a couple of questions is fine.");
  }
  if (p.value.stops >= 2) out.push("They have pressed Stop on questions more than once. Keep it to one question, then plan.");
  const ask = askPattern(events);
  if (ask.value && ask.value !== "other") out.push(`In task chats they most often ask about ${ASK_ADVICE[ask.value]}.`);
  return out;
}

/** The calibration lines the AI sees, in plain words. Empty while unsure. */
export function calibrationLines(events: StepEvent[]): string[] {
  const out: string[] = [];
  const t = timeMultiplier(events);
  if (t.samples >= MIN_SAMPLES && Math.abs(t.value - 1) >= 0.15) {
    out.push(`Steps take this student about ${t.value}× the estimate (from ${t.samples} finished steps). Size estimates to match.`);
  }
  const hours = completionByHour(events);
  if (hours.value.best.length) {
    out.push(`They usually finish work around ${hours.value.best.map(hourLabel).join(", ")} (from ${hours.samples} done steps).`);
  }
  const size = preferredStepSize(events);
  if (size.value !== null) out.push(`Steps they finish are about ${size.value} minutes; keep new steps near that size.`);
  return out;
}
