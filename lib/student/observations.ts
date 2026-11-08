// Layer 2 of the context engine: what Tangent sees the student do, and the
// three numbers it learns from it. Pure. Rows live in `step_events`
// (lib/student/step-events.ts writes them); only what these numbers need is kept:
// the kind, the local hour and weekday, the step's estimate, and a short code.

export const STEP_EVENT_KINDS = ["created", "done", "skipped", "not_today", "too_big", "rescheduled", "check_in"] as const;
export type StepEventKind = (typeof STEP_EVENT_KINDS)[number];

/** "Not today" reasons: codes, never free text. */
export const NOT_TODAY_REASONS = ["no_time", "too_tired", "not_ready", "forgot", "other"] as const;
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
  return typeof v === "string" && (STEP_EVENT_KINDS as readonly string[]).includes(v);
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
