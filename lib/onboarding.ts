// First-run onboarding: the questions, their allowed answers, the unfinished
// draft a student can leave and resume, and the fixed copy on the final
// screen. Pure on purpose (no React, no fetch, no storage of its own) so the
// flow, the API route and the tests all agree on one definition.
//
// Every answer is optional in storage: NULL means "not answered", and
// lib/personalize.ts falls back to Tangent's default behavior for it.

import { formatTime12 } from "./dates";

// ─── Allowed answers (mirrors the check constraints in
//     supabase/migrations/20260929000000_profile_onboarding_preferences.sql) ──

export const HELP_FOCUS = ["school", "goals", "balance", "unsure"] as const;
export const SLIP_POINTS = ["assignments", "projects", "ideas", "deadlines", "everything"] as const;
export const DAY_VIEWS = ["next", "day", "week", "goals"] as const;
export const WORKING_TOWARD = ["school", "build", "skill", "prepare", "organized"] as const;

export type HelpFocus = (typeof HELP_FOCUS)[number];
export type SlipPoint = (typeof SLIP_POINTS)[number];
export type DayView = (typeof DAY_VIEWS)[number];
export type WorkingToward = (typeof WORKING_TOWARD)[number];

export const STARTING_INTENT_MAX = 140;
export const DISPLAY_NAME_MAX = 100;

/** The saved answers, as they live on the profile. */
export type OnboardingPreferences = {
  helpFocus: HelpFocus | null;
  slipPoint: SlipPoint | null;
  dayView: DayView | null;
  workingToward: WorkingToward | null;
  startingIntent: string | null;
};

export const EMPTY_PREFERENCES: OnboardingPreferences = {
  helpFocus: null,
  slipPoint: null,
  dayView: null,
  workingToward: null,
  startingIntent: null,
};

function oneOf<T extends string>(allowed: readonly T[]) {
  return (value: unknown): T | null =>
    typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export const parseHelpFocus = oneOf(HELP_FOCUS);
export const parseSlipPoint = oneOf(SLIP_POINTS);
export const parseDayView = oneOf(DAY_VIEWS);
export const parseWorkingToward = oneOf(WORKING_TOWARD);

/** Trims, collapses whitespace and caps at 140 characters; empty means none. */
export function cleanStartingIntent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, STARTING_INTENT_MAX).trim();
  return text || null;
}

/** Whatever a profile row holds, only known answers survive. */
export function preferencesFrom(raw: Partial<Record<keyof OnboardingPreferences, unknown>> | null | undefined): OnboardingPreferences {
  return {
    helpFocus: parseHelpFocus(raw?.helpFocus),
    slipPoint: parseSlipPoint(raw?.slipPoint),
    dayView: parseDayView(raw?.dayView),
    workingToward: parseWorkingToward(raw?.workingToward),
    startingIntent: cleanStartingIntent(raw?.startingIntent),
  };
}

// ─── Question copy ───────────────────────────────────────────────────────────

export type Choice<T extends string> = { value: T; label: string; hint?: string };

export const HELP_FOCUS_OPTIONS: Choice<HelpFocus>[] = [
  { value: "school", label: "Stay on top of school", hint: "Assignments, tests, deadlines" },
  { value: "goals", label: "Make progress on bigger goals", hint: "Projects, competitions, skills" },
  { value: "balance", label: "Balance everything", hint: "School, activities, goals" },
  { value: "unsure", label: "I'm not sure yet", hint: "Help me figure it out" },
];

export const SLIP_POINT_OPTIONS: Choice<SlipPoint>[] = [
  { value: "assignments", label: "Assignments" },
  { value: "projects", label: "Long-term projects" },
  { value: "ideas", label: "Ideas & opportunities" },
  { value: "deadlines", label: "Deadlines" },
  { value: "everything", label: "A little of everything" },
];

export const DAY_VIEW_OPTIONS: Choice<DayView>[] = [
  { value: "next", label: "What's next", hint: "Just give me my next move" },
  { value: "day", label: "Today's plan", hint: "See everything today" },
  { value: "week", label: "This week", hint: "See what's coming" },
  { value: "goals", label: "Bigger goals", hint: "Keep long-term progress visible" },
];

export const WORKING_TOWARD_OPTIONS: Choice<WorkingToward>[] = [
  { value: "school", label: "Do better in school" },
  { value: "build", label: "Build something" },
  { value: "skill", label: "Get better at a skill" },
  { value: "prepare", label: "Prepare for something important" },
  { value: "organized", label: "Feel more organized" },
];

export const INTENT_EXAMPLES = [
  "Prepare for robotics regionals",
  "Get ready for my chemistry test",
  "Build my portfolio",
  "Learn Python",
  "Start a research project",
] as const;

export function labelFor<T extends string>(options: Choice<T>[], value: T | null | undefined): string | null {
  return options.find((o) => o.value === value)?.label ?? null;
}

// ─── School hours ────────────────────────────────────────────────────────────

/** 0 = Sunday … 6 = Saturday, matching RecurringConfig.daysOfWeek. */
export type SchoolHours = { days: number[]; start: string; end: string };

/** "set" saves a School block; "varies" and "skip" save none. */
export type SchoolMode = "set" | "varies" | "skip";

export const DEFAULT_SCHOOL_HOURS: SchoolHours = { days: [1, 2, 3, 4, 5], start: "08:00", end: "15:00" };

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** A usable schedule, or null: at least one weekday, real "HH:MM" times, and
 *  an end after the start. Days are de-duplicated and sorted. */
export function parseSchoolHours(raw: unknown): SchoolHours | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.days) || typeof r.start !== "string" || typeof r.end !== "string") return null;
  if (!TIME_RE.test(r.start) || !TIME_RE.test(r.end)) return null;
  if (minutesOf(r.end) <= minutesOf(r.start)) return null;
  const days = Array.from(new Set(r.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))).sort((a, b) => a - b);
  if (!days.length || days.length !== r.days.length) return null;
  return { days, start: r.start, end: r.end };
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon–Fri", "Every day", "Mon, Wed, Fri". Weeks read Monday first. */
export function formatSchoolDays(days: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const picked = order.filter((d) => days.includes(d));
  if (!picked.length) return "";
  if (picked.length === 7) return "Every day";
  const first = order.indexOf(picked[0]);
  const contiguous = picked.every((d, i) => order.indexOf(d) === first + i);
  if (contiguous && picked.length >= 3) return `${DAY_SHORT[picked[0]]}–${DAY_SHORT[picked[picked.length - 1]]}`;
  return picked.map((d) => DAY_SHORT[d]).join(", ");
}

export function formatSchoolHours(hours: SchoolHours): string {
  return `${formatSchoolDays(hours.days)} · ${formatTime12(hours.start)}–${formatTime12(hours.end)}`;
}

// ─── The flow and its draft ──────────────────────────────────────────────────

export type StepId = "name" | "help" | "slip" | "view" | "school" | "toward" | "intent" | "ready";

const QUESTION_STEPS: StepId[] = ["help", "slip", "view", "school", "toward", "intent", "ready"];

/** The name step only shows when the profile has no display name. */
export function stepsFor(needsName: boolean): StepId[] {
  return needsName ? ["name", ...QUESTION_STEPS] : [...QUESTION_STEPS];
}

export type OnboardingDraft = {
  name: string;
  helpFocus: HelpFocus | null;
  slipPoint: SlipPoint | null;
  dayView: DayView | null;
  schoolMode: SchoolMode | null;
  school: SchoolHours;
  workingToward: WorkingToward | null;
  /** Raw text while typing; cleaned on save. */
  startingIntent: string;
};

export function emptyDraft(): OnboardingDraft {
  return {
    name: "",
    helpFocus: null,
    slipPoint: null,
    dayView: null,
    schoolMode: null,
    school: { ...DEFAULT_SCHOOL_HOURS, days: [...DEFAULT_SCHOOL_HOURS.days] },
    workingToward: null,
    startingIntent: "",
  };
}

/** "Redo setup": start from what's already saved. The starting intent is not
 *  carried over; it is a one-time prompt, not a setting. */
export function draftFromSaved(saved: {
  displayName?: string;
  preferences?: Partial<OnboardingPreferences> | null;
  school?: SchoolHours | null;
}): OnboardingDraft {
  const prefs = preferencesFrom(saved.preferences ?? null);
  const school = saved.school ? parseSchoolHours(saved.school) : null;
  const answeredBefore = prefs.helpFocus !== null;
  return {
    ...emptyDraft(),
    name: (saved.displayName ?? "").trim(),
    helpFocus: prefs.helpFocus,
    slipPoint: prefs.slipPoint,
    dayView: prefs.dayView,
    workingToward: prefs.workingToward,
    schoolMode: school ? "set" : answeredBefore ? "skip" : null,
    school: school ?? emptyDraft().school,
  };
}

/** Whether Continue is allowed on a step. The school and intent steps always
 *  have a way through ("My schedule varies", "Skip for now"). */
export function canContinue(step: StepId, draft: OnboardingDraft): boolean {
  switch (step) {
    case "name":
      return draft.name.trim().length > 0;
    case "help":
      return draft.helpFocus !== null;
    case "slip":
      return draft.slipPoint !== null;
    case "view":
      return draft.dayView !== null;
    case "school":
      return draft.schoolMode !== "set" || parseSchoolHours(draft.school) !== null;
    case "toward":
      return draft.workingToward !== null;
    case "intent":
    case "ready":
      return true;
  }
}

export type StoredDraft = { v: 1; step: StepId; draft: OnboardingDraft };

export function draftStorageKey(userKey: string): string {
  return `tangent-onboarding-draft:${userKey.trim().toLowerCase()}`;
}

/** Reads a stored draft back, keeping only valid fields. Anything malformed
 *  yields null and the flow simply starts fresh. */
export function parseStoredDraft(raw: string | null | undefined): StoredDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const d = data as { v?: unknown; step?: unknown; draft?: Record<string, unknown> };
  if (d.v !== 1 || !d.draft || typeof d.draft !== "object") return null;
  const allSteps = stepsFor(true);
  const step = allSteps.includes(d.step as StepId) ? (d.step as StepId) : "help";
  const src = d.draft;
  const base = emptyDraft();
  const schoolMode = ["set", "varies", "skip"].includes(src.schoolMode as string) ? (src.schoolMode as SchoolMode) : null;
  // Keep a half-edited schedule only if it is well formed; otherwise defaults.
  const school = parseSchoolHours(src.school) ?? base.school;
  return {
    v: 1,
    step,
    draft: {
      name: typeof src.name === "string" ? src.name.slice(0, DISPLAY_NAME_MAX) : "",
      helpFocus: parseHelpFocus(src.helpFocus),
      slipPoint: parseSlipPoint(src.slipPoint),
      dayView: parseDayView(src.dayView),
      schoolMode,
      school,
      workingToward: parseWorkingToward(src.workingToward),
      startingIntent: typeof src.startingIntent === "string" ? src.startingIntent.slice(0, STARTING_INTENT_MAX) : "",
    },
  };
}

export function serializeDraft(step: StepId, draft: OnboardingDraft): string {
  const stored: StoredDraft = { v: 1, step, draft };
  return JSON.stringify(stored);
}

/** The first step, in `steps`, that can't be continued past yet. Used when a
 *  resumed draft points further along than its answers allow. */
export function resumeStep(steps: StepId[], wanted: StepId, draft: OnboardingDraft): StepId {
  const target = steps.includes(wanted) ? steps.indexOf(wanted) : 0;
  for (let i = 0; i < target; i++) {
    if (!canContinue(steps[i], draft)) return steps[i];
  }
  return steps[target];
}

// ─── Submission (client → POST /api/onboarding) ──────────────────────────────

export type OnboardingSubmission = {
  displayName?: string;
  timezone?: string;
  preferences: OnboardingPreferences;
  /** null: no School block ("My schedule varies" or "Skip"). */
  school: SchoolHours | null;
};

export function submissionFromDraft(draft: OnboardingDraft, opts: { includeName: boolean; timezone?: string }): OnboardingSubmission {
  return {
    ...(opts.includeName && draft.name.trim() ? { displayName: draft.name.trim().slice(0, DISPLAY_NAME_MAX) } : {}),
    ...(opts.timezone ? { timezone: opts.timezone } : {}),
    preferences: {
      helpFocus: draft.helpFocus,
      slipPoint: draft.slipPoint,
      dayView: draft.dayView,
      workingToward: draft.workingToward,
      startingIntent: cleanStartingIntent(draft.startingIntent),
    },
    school: draft.schoolMode === "set" ? parseSchoolHours(draft.school) : null,
  };
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function checkEnum<T extends string>(
  body: Record<string, unknown>,
  key: string,
  parse: (v: unknown) => T | null
): Parsed<T | null> {
  const v = body[key];
  if (v === undefined || v === null) return { ok: true, value: null };
  const parsed = parse(v);
  return parsed === null ? { ok: false, error: `Unknown ${key}` } : { ok: true, value: parsed };
}

function checkIntent(v: unknown): Parsed<string | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  if (typeof v !== "string") return { ok: false, error: "startingIntent must be text" };
  if (v.trim().length > STARTING_INTENT_MAX) return { ok: false, error: "startingIntent is too long" };
  return { ok: true, value: cleanStartingIntent(v) };
}

/** Server-side validation of the onboarding POST body. Unknown answers are
 *  rejected rather than silently dropped, so a stale client can't save junk. */
export function parseSubmission(raw: unknown): Parsed<OnboardingSubmission> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid body" };
  const body = raw as Record<string, unknown>;
  const prefsRaw = (body.preferences ?? {}) as Record<string, unknown>;
  if (typeof prefsRaw !== "object") return { ok: false, error: "Invalid preferences" };

  const help = checkEnum(prefsRaw, "helpFocus", parseHelpFocus);
  const slip = checkEnum(prefsRaw, "slipPoint", parseSlipPoint);
  const view = checkEnum(prefsRaw, "dayView", parseDayView);
  const toward = checkEnum(prefsRaw, "workingToward", parseWorkingToward);
  const intent = checkIntent(prefsRaw.startingIntent);
  for (const r of [help, slip, view, toward, intent]) if (!r.ok) return r;

  let school: SchoolHours | null = null;
  if (body.school !== undefined && body.school !== null) {
    school = parseSchoolHours(body.school);
    if (!school) return { ok: false, error: "Invalid school hours" };
  }

  return {
    ok: true,
    value: {
      ...(typeof body.displayName === "string" && body.displayName.trim()
        ? { displayName: body.displayName.trim().slice(0, DISPLAY_NAME_MAX) }
        : {}),
      ...(typeof body.timezone === "string" ? { timezone: body.timezone } : {}),
      preferences: {
        helpFocus: (help as { value: HelpFocus | null }).value,
        slipPoint: (slip as { value: SlipPoint | null }).value,
        dayView: (view as { value: DayView | null }).value,
        workingToward: (toward as { value: WorkingToward | null }).value,
        startingIntent: (intent as { value: string | null }).value,
      },
      school,
    },
  };
}

/** A partial update from Settings or the Home starting-point card. Only the
 *  keys present are changed; `startingIntent: null` clears it. */
export type PreferencesPatch = Partial<OnboardingPreferences>;

export function parsePreferencesPatch(raw: unknown): Parsed<PreferencesPatch> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid body" };
  const body = raw as Record<string, unknown>;
  const allowed = ["helpFocus", "slipPoint", "dayView", "workingToward", "startingIntent"];
  const unknownKey = Object.keys(body).find((k) => !allowed.includes(k));
  if (unknownKey) return { ok: false, error: `Unknown field ${unknownKey}` };

  const patch: PreferencesPatch = {};
  const enums = [
    ["helpFocus", parseHelpFocus],
    ["slipPoint", parseSlipPoint],
    ["dayView", parseDayView],
    ["workingToward", parseWorkingToward],
  ] as const;
  for (const [key, parse] of enums) {
    if (!(key in body)) continue;
    const r = checkEnum(body, key, parse as (v: unknown) => string | null);
    if (!r.ok) return r;
    (patch as Record<string, unknown>)[key] = r.value;
  }
  if ("startingIntent" in body) {
    const r = checkIntent(body.startingIntent);
    if (!r.ok) return r;
    patch.startingIntent = r.value;
  }
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update" };
  return { ok: true, value: patch };
}

// ─── Final screen: fixed copy, no AI ─────────────────────────────────────────

const VIEW_LINES: Record<DayView, string> = {
  next: "We'll keep your next move clear.",
  day: "We'll lay out each day so you can see it all.",
  week: "We'll keep the week ahead in view.",
  goals: "We'll keep your bigger goals in sight.",
};

const SLIP_LINES: Record<SlipPoint, string> = {
  assignments: "We'll help assignments land before they're due.",
  deadlines: "We'll surface deadlines before they sneak up on you.",
  projects: "We'll help long projects feel less far away.",
  ideas: "We'll make room for ideas before they disappear.",
  everything: "We'll catch what slips, wherever it comes from.",
};

const TOWARD_LINES: Record<WorkingToward, string> = {
  school: "And we'll help school feel more under control.",
  build: "And we'll help bigger projects become something you can start.",
  skill: "And we'll help practice turn into progress you can see.",
  prepare: "And we'll help you get ready, one step at a time.",
  organized: "And we'll keep everything in one calm place.",
};

/** Two or three personalized lines for "Your Tangent is ready." */
export function readyLines(prefs: Pick<OnboardingPreferences, "dayView" | "slipPoint" | "workingToward">): string[] {
  const lines = [
    prefs.dayView ? VIEW_LINES[prefs.dayView] : VIEW_LINES.next,
    prefs.slipPoint ? SLIP_LINES[prefs.slipPoint] : null,
    prefs.workingToward ? TOWARD_LINES[prefs.workingToward] : null,
  ].filter((l): l is string => Boolean(l));
  return lines;
}

export type SummaryRow = { label: string; value: string };

/** Only the rows that say something: skipped answers are left out. */
export function readySummary(
  prefs: Pick<OnboardingPreferences, "dayView" | "workingToward">,
  school: SchoolHours | null
): SummaryRow[] {
  const rows: SummaryRow[] = [];
  const view = labelFor(DAY_VIEW_OPTIONS, prefs.dayView);
  if (view) rows.push({ label: "Starts with", value: view });
  const toward = labelFor(WORKING_TOWARD_OPTIONS, prefs.workingToward);
  if (toward) rows.push({ label: "Focus", value: toward });
  if (school) rows.push({ label: "School hours", value: formatSchoolHours(school) });
  return rows;
}
