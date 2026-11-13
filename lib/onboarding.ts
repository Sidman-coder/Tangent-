// First-run onboarding: the questions, their allowed answers, the unfinished
// draft a student can leave and resume, and the fixed copy on the final
// screen. Pure on purpose (no React, no fetch, no storage of its own) so the
// flow, the API route and the tests all agree on one definition.
//
// Every answer is optional in storage: NULL means "not answered", and
// lib/personalize.ts falls back to Tangent's default behavior for it.

import { formatTime12 } from "./dates";
import { MAX_COMMITMENTS, commitmentProblem, parseCommitments, type Commitment } from "./commitments";
import { looksDistressed } from "./student/sensitive";

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


// ─── The flow (Round 4 Phase 6: deeper, not longer) ──────────────────────────
// Eight questions, then the ready screen. Only the name is required; every
// question has an optional "Tell me more", and every answer is saved as a
// fact the student said (lib/onboarding-facts.ts).

export const GRADES = ["9", "10", "11", "12", "other"] as const;
export const MATTERS = ["grades", "ap", "sat", "college", "sport", "club", "project", "money"] as const;
export const SLIPS = ["forget", "freeze", "putOff", "fade", "whereToStart", "perfect"] as const;
export const BEST_TIMES = ["mornings", "afterSchool", "evenings", "lateNight"] as const;
export const FOCUS_LENGTHS = ["15", "30", "45", "60"] as const;
export const SCHOOL_NIGHT_HOURS = ["1", "2", "3", "4"] as const;
export const PUSH_STYLES = ["gentle", "straight", "ask"] as const;

export type Grade = (typeof GRADES)[number];
export type Matter = (typeof MATTERS)[number];
export type Slip = (typeof SLIPS)[number];
export type BestTime = (typeof BEST_TIMES)[number];
export type FocusLength = (typeof FOCUS_LENGTHS)[number];
export type SchoolNightHours = (typeof SCHOOL_NIGHT_HOURS)[number];
export type PushStyle = (typeof PUSH_STYLES)[number];

export const parseGrade = oneOf(GRADES);
export const parseMatter = oneOf(MATTERS);
export const parseSlip = oneOf(SLIPS);
export const parseBestTime = oneOf(BEST_TIMES);
export const parseFocusLength = oneOf(FOCUS_LENGTHS);
export const parseSchoolNightHours = oneOf(SCHOOL_NIGHT_HOURS);
export const parsePushStyle = oneOf(PUSH_STYLES);

export const MAX_SLIPS = 2;
/** "Tell me more" and the longer free-text answers. */
export const MORE_MAX = 300;
export const SHORT_TEXT_MAX = 80;

export const GRADE_OPTIONS: Choice<Grade>[] = [
  { value: "9", label: "9th" },
  { value: "10", label: "10th" },
  { value: "11", label: "11th" },
  { value: "12", label: "12th" },
  { value: "other", label: "Other" },
];

export const MATTER_OPTIONS: Choice<Matter>[] = [
  { value: "grades", label: "Grades" },
  { value: "ap", label: "AP exams" },
  { value: "sat", label: "SAT/ACT" },
  { value: "college", label: "College apps" },
  { value: "sport", label: "A sport" },
  { value: "club", label: "A club or competition" },
  { value: "project", label: "A personal project" },
  { value: "money", label: "Money or a job" },
];

export const SLIP_OPTIONS: Choice<Slip>[] = [
  { value: "forget", label: "I forget things" },
  { value: "freeze", label: "There's too much and I freeze" },
  { value: "putOff", label: "I put it off until the last minute" },
  { value: "fade", label: "I start strong, then fade" },
  { value: "whereToStart", label: "I don't know where to start" },
  { value: "perfect", label: "I get stuck making it perfect" },
];

export const BEST_TIME_OPTIONS: Choice<BestTime>[] = [
  { value: "mornings", label: "Mornings" },
  { value: "afterSchool", label: "After school" },
  { value: "evenings", label: "Evenings" },
  { value: "lateNight", label: "Late night" },
];

export const FOCUS_LENGTH_OPTIONS: Choice<FocusLength>[] = [
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "45", label: "45 min" },
  { value: "60", label: "60+ min" },
];

export const SCHOOL_NIGHT_OPTIONS: Choice<SchoolNightHours>[] = [
  { value: "1", label: "1 hour" },
  { value: "2", label: "2 hours" },
  { value: "3", label: "3 hours" },
  { value: "4", label: "4+ hours" },
];

export const PUSH_OPTIONS: Choice<PushStyle>[] = [
  { value: "gentle", label: "Gentle nudges", hint: "A friendly heads-up when something's close" },
  { value: "straight", label: "Straight-up accountability", hint: "Tell me when I'm falling behind" },
  { value: "ask", label: "Only when I ask", hint: "Stay quiet until I come to you" },
];

export type StepId = "about" | "busy" | "matters" | "slip" | "bugging" | "brain" | "toward" | "push" | "ready";
export type QuestionStep = Exclude<StepId, "ready">;

export const STEPS: StepId[] = ["about", "busy", "matters", "slip", "bugging", "brain", "toward", "push", "ready"];
export const QUESTION_STEPS = STEPS.filter((s): s is QuestionStep => s !== "ready");

export type Toward = { major: string; career: string; dream: string; notSure: boolean };

export type OnboardingDraft = {
  name: string;
  grade: Grade | null;
  commitments: Commitment[];
  /** False until the saved commitments are known (Redo setup loads them), so
   *  a list that never loaded can't wipe the calendar. */
  commitmentsKnown: boolean;
  matters: Matter[];
  mattersText: string;
  slips: Slip[];
  /** Raw while typing; it becomes the starting intent on save. */
  bugging: string;
  bestTime: BestTime | null;
  focusLength: FocusLength | null;
  schoolNightHours: SchoolNightHours | null;
  toward: Toward;
  push: PushStyle | null;
  /** "Tell me more", per question. */
  more: Partial<Record<QuestionStep, string>>;
  /** No longer asked; kept from an earlier setup so Settings doesn't lose it. */
  dayView: DayView | null;
};

export function emptyDraft(): OnboardingDraft {
  return {
    name: "",
    grade: null,
    commitments: [],
    commitmentsKnown: true,
    matters: [],
    mattersText: "",
    slips: [],
    bugging: "",
    bestTime: null,
    focusLength: null,
    schoolNightHours: null,
    toward: { major: "", career: "", dream: "", notSure: false },
    push: null,
    more: {},
    dayView: null,
  };
}

/** "Redo setup": start from the saved name and day view. Commitments live on
 *  the calendar and are loaded separately, so for an onboarded student they
 *  start unknown. Everything else is asked again. */
export function draftFromSaved(saved: {
  displayName?: string;
  preferences?: Partial<OnboardingPreferences> | null;
  onboarded?: boolean;
}): OnboardingDraft {
  const prefs = preferencesFrom(saved.preferences ?? null);
  return {
    ...emptyDraft(),
    name: (saved.displayName ?? "").trim().slice(0, DISPLAY_NAME_MAX),
    dayView: prefs.dayView,
    commitmentsKnown: !saved.onboarded,
  };
}

/** Whether a step's answers let the student move on. Only the name is
 *  required; a half-filled commitment has to be finished or removed. */
export function canContinue(step: StepId, draft: OnboardingDraft): boolean {
  switch (step) {
    case "about":
      return draft.name.trim().length > 0;
    case "busy":
      return draft.commitments.length <= MAX_COMMITMENTS && draft.commitments.every((c) => commitmentProblem(c) === null);
    case "slip":
      return draft.slips.length <= MAX_SLIPS;
    default:
      return true;
  }
}

/** Whether the student answered anything on a step (Continue vs Skip). */
export function hasAnswer(step: QuestionStep, draft: OnboardingDraft): boolean {
  const more = Boolean(draft.more[step]?.trim());
  switch (step) {
    case "about":
      return draft.name.trim().length > 0;
    case "busy":
      return draft.commitments.length > 0 || more;
    case "matters":
      return draft.matters.length > 0 || Boolean(draft.mattersText.trim()) || more;
    case "slip":
      return draft.slips.length > 0 || more;
    case "bugging":
      return Boolean(draft.bugging.trim()) || more;
    case "brain":
      return Boolean(draft.bestTime || draft.focusLength || draft.schoolNightHours) || more;
    case "toward": {
      const t = draft.toward;
      return Boolean(t.major.trim() || t.career.trim() || t.dream.trim() || t.notSure) || more;
    }
    case "push":
      return draft.push !== null || more;
  }
}

/** Picks a slip or unpicks it; a third pick replaces the oldest. */
export function toggleSlip(slips: Slip[], slip: Slip): Slip[] {
  if (slips.includes(slip)) return slips.filter((s) => s !== slip);
  return [...slips, slip].slice(-MAX_SLIPS);
}

export type StoredDraft = { v: 2; step: StepId; draft: OnboardingDraft };

export function draftStorageKey(userKey: string): string {
  return `tangent-onboarding-draft:${userKey.trim().toLowerCase()}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function listOf<T extends string>(raw: unknown, parse: (v: unknown) => T | null, max: number): T[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(new Set(raw.map(parse).filter((v): v is T => v !== null))).slice(0, max);
}

function parseMore(raw: unknown): Partial<Record<QuestionStep, string>> {
  const out: Partial<Record<QuestionStep, string>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const step of QUESTION_STEPS) {
    const v = (raw as Record<string, unknown>)[step];
    if (typeof v === "string" && v) out[step] = v.slice(0, MORE_MAX);
  }
  return out;
}

/** Reads a stored draft back, keeping only valid fields. Anything malformed,
 *  or a draft from the older flow, gives null and the flow starts fresh. */
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
  if (d.v !== 2 || !d.draft || typeof d.draft !== "object") return null;
  const step = STEPS.includes(d.step as StepId) ? (d.step as StepId) : "about";
  const src = d.draft;
  const t = (src.toward && typeof src.toward === "object" ? src.toward : {}) as Record<string, unknown>;
  return {
    v: 2,
    step,
    draft: {
      name: str(src.name, DISPLAY_NAME_MAX),
      grade: parseGrade(src.grade),
      commitments: parseCommitments(src.commitments) ?? [],
      commitmentsKnown: src.commitmentsKnown !== false,
      matters: listOf(src.matters, parseMatter, MATTERS.length),
      mattersText: str(src.mattersText, MORE_MAX),
      slips: listOf(src.slips, parseSlip, MAX_SLIPS),
      bugging: str(src.bugging, STARTING_INTENT_MAX),
      bestTime: parseBestTime(src.bestTime),
      focusLength: parseFocusLength(src.focusLength),
      schoolNightHours: parseSchoolNightHours(src.schoolNightHours),
      toward: {
        major: str(t.major, SHORT_TEXT_MAX),
        career: str(t.career, SHORT_TEXT_MAX),
        dream: str(t.dream, MORE_MAX),
        notSure: t.notSure === true,
      },
      push: parsePushStyle(src.push),
      more: parseMore(src.more),
      dayView: parseDayView(src.dayView),
    },
  };
}

export function serializeDraft(step: StepId, draft: OnboardingDraft): string {
  const stored: StoredDraft = { v: 2, step, draft };
  return JSON.stringify(stored);
}

/** The first step before `wanted` that can't be continued past, so a resumed
 *  draft never lands further along than its answers allow. */
export function resumeStep(wanted: StepId, draft: OnboardingDraft): StepId {
  const target = Math.max(0, STEPS.indexOf(wanted));
  for (let i = 0; i < target; i++) {
    if (!canContinue(STEPS[i], draft)) return STEPS[i];
  }
  return STEPS[target];
}

// ─── Submission (client → POST /api/onboarding) ──────────────────────────────

/** Everything the eight questions collected, cleaned. */
export type OnboardingAnswers = {
  grade: Grade | null;
  /** null: leave the calendar's busy blocks as they are. */
  commitments: Commitment[] | null;
  matters: Matter[];
  mattersText: string | null;
  slips: Slip[];
  bugging: string | null;
  bestTime: BestTime | null;
  focusLength: FocusLength | null;
  schoolNightHours: SchoolNightHours | null;
  toward: { major: string | null; career: string | null; dream: string | null; notSure: boolean };
  push: PushStyle | null;
  more: Partial<Record<QuestionStep, string>>;
};

export type OnboardingSubmission = {
  displayName?: string;
  timezone?: string;
  /** The older single answers, worked out from `answers` (lib/personalize.ts reads them). */
  preferences: OnboardingPreferences;
  answers: OnboardingAnswers;
};

/** Trims and collapses whitespace; empty means none. */
export function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, max).trim();
  return text || null;
}

const SCHOOLISH: Matter[] = ["grades", "ap", "sat"];

const SLIP_POINT_OF: Record<Slip, SlipPoint> = {
  forget: "deadlines",
  freeze: "everything",
  putOff: "deadlines",
  fade: "projects",
  whereToStart: "projects",
  perfect: "assignments",
};

const TOWARD_OF: Partial<Record<Matter, WorkingToward>> = {
  grades: "school",
  ap: "school",
  sat: "school",
  project: "build",
  sport: "skill",
  club: "skill",
  college: "prepare",
};

/** The text that becomes the starting intent, unless it reads as real
 *  distress (that gets a kind reply, never a plan). */
export function intentFrom(bugging: string | null | undefined): string | null {
  if (!bugging || looksDistressed(bugging)) return null;
  return cleanStartingIntent(bugging);
}

/** The profile's older answers, from the new ones, so everything that reads
 *  them (lib/personalize.ts, Settings) keeps working. */
export function legacyPreferences(answers: OnboardingAnswers, dayView: DayView | null): OnboardingPreferences {
  const school = answers.matters.some((m) => SCHOOLISH.includes(m));
  const goals = answers.matters.some((m) => !SCHOOLISH.includes(m));
  return {
    helpFocus: school && goals ? "balance" : school ? "school" : goals ? "goals" : null,
    slipPoint: answers.slips.length ? SLIP_POINT_OF[answers.slips[0]] : null,
    dayView,
    workingToward: answers.matters.map((m) => TOWARD_OF[m]).find((w): w is WorkingToward => Boolean(w)) ?? null,
    startingIntent: intentFrom(answers.bugging),
  };
}

export function answersFromDraft(draft: OnboardingDraft): OnboardingAnswers {
  const more: Partial<Record<QuestionStep, string>> = {};
  for (const step of QUESTION_STEPS) {
    const text = cleanText(draft.more[step], MORE_MAX);
    if (text) more[step] = text;
  }
  return {
    grade: draft.grade,
    commitments: draft.commitmentsKnown ? draft.commitments : null,
    matters: draft.matters,
    mattersText: cleanText(draft.mattersText, MORE_MAX),
    slips: draft.slips.slice(0, MAX_SLIPS),
    bugging: cleanText(draft.bugging, STARTING_INTENT_MAX),
    bestTime: draft.bestTime,
    focusLength: draft.focusLength,
    schoolNightHours: draft.schoolNightHours,
    toward: {
      major: cleanText(draft.toward.major, SHORT_TEXT_MAX),
      career: cleanText(draft.toward.career, SHORT_TEXT_MAX),
      dream: cleanText(draft.toward.dream, MORE_MAX),
      notSure: draft.toward.notSure,
    },
    push: draft.push,
    more,
  };
}

export function submissionFromDraft(draft: OnboardingDraft, opts: { timezone?: string } = {}): OnboardingSubmission {
  const answers = answersFromDraft(draft);
  const name = draft.name.trim().slice(0, DISPLAY_NAME_MAX);
  return {
    ...(name ? { displayName: name } : {}),
    ...(opts.timezone ? { timezone: opts.timezone } : {}),
    preferences: legacyPreferences(answers, draft.dayView),
    answers,
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

function checkList<T extends string>(raw: unknown, key: string, parse: (v: unknown) => T | null, max: number): Parsed<T[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: `${key} must be a list` };
  const out: T[] = [];
  for (const v of raw) {
    const p = parse(v);
    if (p === null) return { ok: false, error: `Unknown ${key}` };
    if (!out.includes(p)) out.push(p);
  }
  if (out.length > max) return { ok: false, error: `Too many ${key}` };
  return { ok: true, value: out };
}

function checkText(raw: unknown, key: string, max: number): Parsed<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: `${key} must be text` };
  if (raw.trim().length > max) return { ok: false, error: `${key} is too long` };
  return { ok: true, value: cleanText(raw, max) };
}

/** Server-side check of the onboarding POST body. Unknown answers are
 *  rejected rather than dropped, so a stale client can't save junk. The older
 *  preferences are worked out again here; only the day view comes from the
 *  client. */
export function parseSubmission(raw: unknown): Parsed<OnboardingSubmission> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid body" };
  const body = raw as Record<string, unknown>;
  const a = body.answers;
  if (!a || typeof a !== "object" || Array.isArray(a)) return { ok: false, error: "Invalid answers" };
  const src = a as Record<string, unknown>;
  const prefsRaw =
    body.preferences && typeof body.preferences === "object" ? (body.preferences as Record<string, unknown>) : {};

  const grade = checkEnum(src, "grade", parseGrade);
  if (!grade.ok) return grade;
  const bestTime = checkEnum(src, "bestTime", parseBestTime);
  if (!bestTime.ok) return bestTime;
  const focusLength = checkEnum(src, "focusLength", parseFocusLength);
  if (!focusLength.ok) return focusLength;
  const schoolNightHours = checkEnum(src, "schoolNightHours", parseSchoolNightHours);
  if (!schoolNightHours.ok) return schoolNightHours;
  const push = checkEnum(src, "push", parsePushStyle);
  if (!push.ok) return push;
  const view = checkEnum(prefsRaw, "dayView", parseDayView);
  if (!view.ok) return view;
  const matters = checkList(src.matters, "matters", parseMatter, MATTERS.length);
  if (!matters.ok) return matters;
  const slips = checkList(src.slips, "slips", parseSlip, MAX_SLIPS);
  if (!slips.ok) return slips;
  const mattersText = checkText(src.mattersText, "mattersText", MORE_MAX);
  if (!mattersText.ok) return mattersText;
  const bugging = checkIntent(src.bugging);
  if (!bugging.ok) return bugging;
  const towardRaw = (src.toward && typeof src.toward === "object" ? src.toward : {}) as Record<string, unknown>;
  const major = checkText(towardRaw.major, "major", SHORT_TEXT_MAX);
  if (!major.ok) return major;
  const career = checkText(towardRaw.career, "career", SHORT_TEXT_MAX);
  if (!career.ok) return career;
  const dream = checkText(towardRaw.dream, "dream", MORE_MAX);
  if (!dream.ok) return dream;

  let commitments: Commitment[] | null = null;
  if (src.commitments !== undefined && src.commitments !== null) {
    if (Array.isArray(src.commitments) && src.commitments.length > MAX_COMMITMENTS) {
      return { ok: false, error: "Too many commitments" };
    }
    commitments = parseCommitments(src.commitments);
    // A commitment that doesn't parse is rejected, not quietly left off the calendar.
    if (!commitments || commitments.length !== (src.commitments as unknown[]).length) {
      return { ok: false, error: "Invalid commitments" };
    }
  }

  const more: Partial<Record<QuestionStep, string>> = {};
  if (src.more !== undefined && src.more !== null) {
    if (typeof src.more !== "object" || Array.isArray(src.more)) return { ok: false, error: "Invalid more" };
    for (const [key, value] of Object.entries(src.more as Record<string, unknown>)) {
      if (!(QUESTION_STEPS as string[]).includes(key)) return { ok: false, error: `Unknown more.${key}` };
      const r = checkText(value, `more.${key}`, MORE_MAX);
      if (!r.ok) return r;
      if (r.value) more[key as QuestionStep] = r.value;
    }
  }

  const answers: OnboardingAnswers = {
    grade: grade.value,
    commitments,
    matters: matters.value,
    mattersText: mattersText.value,
    slips: slips.value,
    bugging: bugging.value,
    bestTime: bestTime.value,
    focusLength: focusLength.value,
    schoolNightHours: schoolNightHours.value,
    toward: { major: major.value, career: career.value, dream: dream.value, notSure: towardRaw.notSure === true },
    push: push.value,
    more,
  };
  return {
    ok: true,
    value: {
      ...(typeof body.displayName === "string" && body.displayName.trim()
        ? { displayName: body.displayName.trim().slice(0, DISPLAY_NAME_MAX) }
        : {}),
      ...(typeof body.timezone === "string" ? { timezone: body.timezone } : {}),
      preferences: legacyPreferences(answers, view.value),
      answers,
    },
  };
}

/** A partial update from Settings or the Home starting-point card. Only the
 *  keys present change; `startingIntent: null` clears it. */
export type PreferencesPatch = Partial<OnboardingPreferences>;

export function parsePreferencesPatch(raw: unknown): Parsed<PreferencesPatch> {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Invalid body" };
  const body = raw as Record<string, unknown>;
  const patch: PreferencesPatch = {};

  if ("helpFocus" in body) {
    const r = checkEnum(body, "helpFocus", parseHelpFocus);
    if (!r.ok) return r;
    patch.helpFocus = r.value;
  }
  if ("slipPoint" in body) {
    const r = checkEnum(body, "slipPoint", parseSlipPoint);
    if (!r.ok) return r;
    patch.slipPoint = r.value;
  }
  if ("dayView" in body) {
    const r = checkEnum(body, "dayView", parseDayView);
    if (!r.ok) return r;
    patch.dayView = r.value;
  }
  if ("workingToward" in body) {
    const r = checkEnum(body, "workingToward", parseWorkingToward);
    if (!r.ok) return r;
    patch.workingToward = r.value;
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

const PUSH_LINES: Record<PushStyle, string> = {
  gentle: "We'll nudge you, gently, when something's close.",
  straight: "We'll tell you straight when you're falling behind.",
  ask: "We'll stay quiet until you ask.",
};

const SLIP_LINES: Record<Slip, string> = {
  forget: "We'll catch things before they slip your mind.",
  freeze: "When there's too much, we'll pick the one thing to do next.",
  putOff: "We'll start big things early, in small pieces.",
  fade: "We'll help you keep going after the first week.",
  whereToStart: "We'll always show you the first step.",
  perfect: "We'll help you call it done when it's good enough.",
};

/** Two or three short lines for "Your Tangent is ready." */
export function readyLines(answers: Pick<OnboardingAnswers, "slips" | "push" | "bugging">): string[] {
  const lines: string[] = [];
  if (answers.slips.length) lines.push(SLIP_LINES[answers.slips[0]]);
  if (answers.push) lines.push(PUSH_LINES[answers.push]);
  const first = intentFrom(answers.bugging);
  if (first) lines.push(`First up: ${first.replace(/[.!?]+$/, "")}. We'll plan it together on Home.`);
  if (!lines.length) lines.push("We'll keep your next move clear.");
  return lines;
}

export type SummaryRow = { label: string; value: string };

/** Only rows that say something: skipped answers are left out. */
export function readySummary(answers: OnboardingAnswers): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (answers.commitments?.length) {
    rows.push({ label: "Busy with", value: answers.commitments.map((c) => c.name).join(", ") });
  }
  const time = labelFor(BEST_TIME_OPTIONS, answers.bestTime);
  const focus = labelFor(FOCUS_LENGTH_OPTIONS, answers.focusLength);
  if (time || focus) {
    rows.push({ label: "Works best", value: [time, focus && `${focus} at a time`].filter(Boolean).join(" · ") });
  }
  const hours = labelFor(SCHOOL_NIGHT_OPTIONS, answers.schoolNightHours);
  if (hours) rows.push({ label: "School nights", value: hours });
  const push = labelFor(PUSH_OPTIONS, answers.push);
  if (push) rows.push({ label: "Push", value: push });
  return rows;
}
