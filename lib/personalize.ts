// What the onboarding answers change, in one place. Pure: every screen asks
// this module and renders what it says. Small, visible nudges only (an order,
// an example, a starter card), never a different dashboard, and never a
// redirect. A missing or unknown answer always falls back to exactly what
// Tangent did before onboarding asked anything, so existing students see no
// change.

import type { DayView, HelpFocus, OnboardingPreferences, SlipPoint, WorkingToward } from "./onboarding";
import { preferencesFrom } from "./onboarding";
import type { PathGoalKind } from "./types";

export type Prefs = OnboardingPreferences;

/** Accepts a UserProfile (or anything shaped like one) and keeps only known
 *  answers. Safe on null, undefined and stale values. */
export function prefsOf(user: Partial<Record<keyof Prefs, unknown>> | null | undefined): Prefs {
  return preferencesFrom(user ?? null);
}

// ─── Home ────────────────────────────────────────────────────────────────────

/** The three Home blocks, in the order the student sees them. */
export type HomeSection = "attention" | "insights" | "dayline";

export type HomeLayout = {
  order: HomeSection[];
  /** Show the Paths starter/progress card, and where. */
  pathsCard: "none" | "top";
  /** An "Open week" link on the week-ahead card. */
  openWeekLink: boolean;
  /** Line under "Your day" when nothing is scheduled. */
  todayEmpty: string;
  /** When set, the empty line offers to open capture with this label. */
  todayEmptyAction: string | null;
};

export const DEFAULT_HOME: HomeLayout = {
  order: ["attention", "insights", "dayline"],
  pathsCard: "none",
  openWeekLink: false,
  todayEmpty: "Nothing scheduled yet.",
  todayEmptyAction: null,
};

const ORDER_BY_VIEW: Record<DayView, HomeSection[]> = {
  // Attention already leads by default; "next" keeps it there.
  next: ["attention", "insights", "dayline"],
  day: ["dayline", "attention", "insights"],
  week: ["insights", "attention", "dayline"],
  goals: ["attention", "insights", "dayline"],
};

export function homeLayout(prefs: Prefs): HomeLayout {
  const layout: HomeLayout = { ...DEFAULT_HOME, order: [...DEFAULT_HOME.order] };
  if (prefs.dayView) layout.order = [...ORDER_BY_VIEW[prefs.dayView]];
  if (prefs.dayView === "week") layout.openWeekLink = true;
  if (prefs.dayView === "goals" || prefs.helpFocus === "goals") layout.pathsCard = "top";
  if (prefs.helpFocus === "school") {
    layout.todayEmpty = "Got something due soon?";
    layout.todayEmptyAction = "Tell Tangent";
  }
  return layout;
}

// ─── Capture (command palette) ───────────────────────────────────────────────

export type CaptureQuickAction = { label: string; kind: "prefill" | "ask" | "navigate"; value: string };

export const DEFAULT_CAPTURE_PLACEHOLDER = "Add a task, ask a question…";

/** The palette's own actions, unchanged for anyone without answers. */
export const DEFAULT_QUICK_ACTIONS: CaptureQuickAction[] = [
  { label: "Add a task", kind: "prefill", value: "Add a task: " },
  { label: "Create a plan", kind: "prefill", value: "Create a plan for " },
  { label: "What's on today?", kind: "ask", value: "What's on today?" },
  { label: "Summarize my email", kind: "ask", value: "Summarize my email" },
  { label: "Go to calendar", kind: "navigate", value: "/calendar" },
];

type CaptureCopy = { placeholder: string; example: CaptureQuickAction | null };

const SLIP_CAPTURE: Record<SlipPoint, CaptureCopy> = {
  assignments: {
    placeholder: "Help me plan for my chemistry test Friday",
    example: { label: "Plan for a test", kind: "prefill", value: "Help me plan for my chemistry test Friday" },
  },
  deadlines: {
    placeholder: "Help me plan for my chemistry test Friday",
    example: { label: "Plan for a test", kind: "prefill", value: "Help me plan for my chemistry test Friday" },
  },
  projects: {
    placeholder: "Break a big project into first steps",
    example: { label: "Break down a project", kind: "prefill", value: "Break a big project into first steps: " },
  },
  ideas: {
    placeholder: "Thought of something worth doing? Drop it here.",
    example: { label: "Remind me to email about that research program", kind: "prefill", value: "Remind me to email about that research program" },
  },
  everything: {
    placeholder: DEFAULT_CAPTURE_PLACEHOLDER,
    example: null,
  },
};

const SCHOOL_FOCUS_CAPTURE: CaptureCopy = {
  placeholder: "Essay due Thursday, quiz on Monday…",
  example: { label: "Add an assignment", kind: "prefill", value: "Add an assignment: " },
};

/** The palette's placeholder and quick actions. The slip point is the most
 *  specific answer, so it wins; a school focus only fills in when the slip
 *  point says nothing more specific. One example is added, never removed. */
export function captureCopy(prefs: Prefs): { placeholder: string; quickActions: CaptureQuickAction[] } {
  const bySlip = prefs.slipPoint ? SLIP_CAPTURE[prefs.slipPoint] : null;
  const bySchool = prefs.helpFocus === "school" ? SCHOOL_FOCUS_CAPTURE : null;
  const chosen = bySlip?.example ? bySlip : bySchool ?? bySlip;
  if (!chosen) return { placeholder: DEFAULT_CAPTURE_PLACEHOLDER, quickActions: DEFAULT_QUICK_ACTIONS };
  const quickActions = chosen.example
    ? [chosen.example, ...DEFAULT_QUICK_ACTIONS.filter((a) => a.label !== chosen.example!.label)]
    : DEFAULT_QUICK_ACTIONS;
  return { placeholder: chosen.placeholder, quickActions };
}

// ─── Tangent AI ──────────────────────────────────────────────────────────────

export type AiSuggestionKey = "plan-week" | "today" | "thirty" | "overdue" | "study" | "project" | "practice" | "prepare" | "organize";

export type AiSuggestion = { key: AiSuggestionKey; text: string; detail: string };

const TOWARD_AI: Record<WorkingToward, AiSuggestion> = {
  school: { key: "study", text: "Make a study plan", detail: "Spread studying for your next test across the week" },
  build: { key: "project", text: "What's my next step on my project?", detail: "One concrete thing to move it forward" },
  skill: { key: "practice", text: "Plan my practice this week", detail: "Short, regular sessions that fit your schedule" },
  prepare: { key: "prepare", text: "Help me get ready for something big", detail: "Work backward from the date to this week" },
  organized: { key: "organize", text: "Help me get organized", detail: "Sort everything on your plate into a plan" },
};

/** The first suggestion on an empty Tangent AI page, or null to keep the
 *  default list unchanged. */
export function aiFirstSuggestion(prefs: Prefs): AiSuggestion | null {
  return prefs.workingToward ? TOWARD_AI[prefs.workingToward] : null;
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export type CalendarView = "week" | "month" | "agenda";

/** A view the student saved always wins. Otherwise "This week" opens the
 *  week view; everyone else keeps the current default (agenda on narrow
 *  screens, week on wide ones). */
export function initialCalendarView(prefs: Prefs, saved: CalendarView | null, narrow: boolean): CalendarView {
  if (saved) return saved;
  if (prefs.dayView === "week") return "week";
  return narrow ? "agenda" : "week";
}

// ─── Paths ───────────────────────────────────────────────────────────────────

/** Which kind a new Path starts on. Only a clear match preselects; the
 *  student still confirms it. */
export function initialPathKind(prefs: Prefs): PathGoalKind | null {
  switch (prefs.workingToward) {
    case "skill":
      return "skill";
    case "build":
    case "prepare":
      return "other";
    default:
      return null;
  }
}

export type PathsEmptyCopy = { title: string; body: string; cta: string };

export const DEFAULT_PATHS_EMPTY: PathsEmptyCopy = {
  title: "Nothing in orbit yet",
  body: "A path is one thing you are trying to reach: a university place, a job, a rating, a body of work. Tangent branches off what you already have to get you there.",
  cta: "Start your first path",
};

const TOWARD_PATHS: Partial<Record<WorkingToward, PathsEmptyCopy>> = {
  build: {
    title: "What are you building?",
    body: "A project, a portfolio, an app. Make it a path and Tangent branches off what you already have toward a first version.",
    cta: "Start a build path",
  },
  skill: {
    title: "What are you getting better at?",
    body: "A rating, a grade, an instrument, a language. Make it a path and Tangent turns practice into steps you can see.",
    cta: "Start a skill path",
  },
  prepare: {
    title: "What are you getting ready for?",
    body: "A competition, an audition, an exam. Make it a path and Tangent works backward from the date to what you can do this week.",
    cta: "Start preparing",
  },
  school: {
    title: "Where is school taking you?",
    body: "A class to pull up, a program to get into. Make it a path and Tangent branches off what you already have to get you there.",
    cta: "Start your first path",
  },
};

export function pathsEmptyCopy(prefs: Prefs): PathsEmptyCopy {
  return (prefs.workingToward && TOWARD_PATHS[prefs.workingToward]) || DEFAULT_PATHS_EMPTY;
}

/** Copy for the Home Paths card when the student has no paths yet. */
export function pathsStarterCopy(prefs: Prefs): { title: string; body: string; cta: string } {
  const empty = pathsEmptyCopy(prefs);
  if (empty === DEFAULT_PATHS_EMPTY) {
    return {
      title: "Keep a bigger goal in view",
      body: "A path turns one long-term goal into steps you can start this week.",
      cta: "Start a path",
    };
  }
  return { title: empty.title, body: "Make it a path and see the first steps.", cta: empty.cta };
}

// ─── Help focus ──────────────────────────────────────────────────────────────

export const HELP_FOCUS_SUMMARY: Record<HelpFocus, string> = {
  school: "Staying on top of school",
  goals: "Making progress on bigger goals",
  balance: "Balancing everything",
  unsure: "Figuring it out as you go",
};
