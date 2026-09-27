export type TaskKind = "school" | "academic-ec" | "side-ec" | "personal" | "commitment";

export type RecurringConfig = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  daysOfWeek?: number[]; // 0=Sun … 6=Sat
  dayOfMonth?: number;
  endDate?: string;       // YYYY-MM-DD
  occurrences?: number;
  parentId?: string;      // shared across all instances of the same series
};

export type Task = {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  time: string;       // HH:MM 24-hour
  completed: boolean;
  /**
   * school: recurring school block from onboarding
   * commitment: recurring non-goal activities (practice, coaching, club meetings) — scheduled, no completion tracking, no plan
   * academic-ec: research, competitions, olympiads — main extracurriculars colleges weigh heavily
   * side-ec: sports, hobbies, secondary activities
   * personal: default fallback
   */
  kind?: TaskKind;
  calendarId?: string | null;
  planId?: string | null;
  notes?: string;
  recurring?: RecurringConfig;
  resources?: Array<{ label: string; url: string }>;
  startAction?: string;
  /** Set when this task was created by an external ingestion path rather than the user or AI. */
  source?: "canvas";
  /** The event's UID in its source feed. Lets a re-sync move or rename the task
   *  it already made instead of adding a second copy. */
  externalId?: string;
};

export type Plan = {
  id: string;
  title: string;
  description: string;
  taskIds: string[];
  color: string;
  createdAt: string;
  taskCount: number;
};

export type CalendarCategory = "ALL" | string;

export type CalendarDef = {
  id: string;
  name: string;
  category: CalendarCategory;
  color?: string;
};

// Alias matching the { id, name, color } shape used by calendar-intelligence
// code (getCalendars, moveTasksToCalendar, voice/agent prompts). CalendarDef
// is the canonical definition — this just gives it the name that code expects.
export type Calendar = CalendarDef;

export type CalendarEvent = {
  id: string;
  calendarId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
};

export type UserProfile = {
  displayName: string;
  email: string;
};

export type VoiceLogEntry = {
  at: string;
  text: string;
  response: string;
  action: string;
  ok: boolean;
};

export type AppState = {
  tasks: Task[];
  calendars: CalendarDef[];
  events: CalendarEvent[];
  user: UserProfile;
  weeklyPlan: string[];
  lastVoiceCommand: string | null;
  lastVoiceResponse: string | null;
  plans: Plan[];
};

export interface ContextEntry {
  id: string;
  timestamp: string;
  category: "preference" | "habit" | "commitment" | "goal" | "person" | "work" | "general";
  fact: string; // the extracted key point
  source: "chat" | "voice" | "manual";
}

export interface UserContext {
  entries: ContextEntry[];
  compressedSummary: string; // the compressed version when entries get long
  lastUpdated: string;
  totalInteractions: number;
}

export interface BriefSource {
  id: string;
  type: "rss" | "stale_check" | "manual_url";
  label: string;
  url?: string;
  lastFetched?: string;
}

export interface BriefConfig {
  sources: BriefSource[];
  cadence: "daily" | "weekdays" | "weekly";
  deliveryTime: string; // "07:00"
}

export interface CanvasFeedConfig {
  icsUrl: string;
  /** IANA zone the person's browser reported, e.g. "America/New_York". Due
   *  times are converted into it; the server itself runs on UTC. */
  timeZone?: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncCount: number;
}

// An Anthropic Message Batch submitted by the daily-brief cron job, awaiting a
// result on a later cron tick. See app/api/cron/daily-brief/route.ts.
export interface PendingBriefBatch {
  batchId: string;
  submittedAt: string;
}

export interface Notification {
  id: string;
  timestamp: string;
  type: "proactive_suggestion" | "daily_brief" | "overdue_task" | "upcoming_deadline" | "reschedule_offer";
  title: string;
  body: string;
  actionLabel?: string;
  actionData?: Record<string, unknown>;
  read: boolean;
  dismissed: boolean;
}

// ─── Action Receipts + Undo ────────────────────────────────────────────────
export type ActionKind =
  | "add_task"
  | "complete_task"
  | "delete_task"
  | "delete_all_tasks"
  | "add_recurring_task"
  | "create_plan"
  | "move_tasks"
  | "reschedule_task";

export type ActionSnapshot = {
  /** Full task objects removed by delete_task / delete_all_tasks — restored on undo. */
  removedTasks?: Task[];
  /** Ids of tasks added by add_task / create_plan / add_recurring_task — deleted on undo. */
  addedTaskIds?: string[];
  /** Plan id added by create_plan — deleted on undo alongside its tasks. */
  addedPlanId?: string;
  /** Task id completed by complete_task — un-completed on undo. */
  completedTaskId?: string;
  /** Prior calendarId per task moved by move_tasks — restored on undo. */
  moves?: { taskId: string; fromCalendarId: string | null }[];
  /** Prior date/time for a task rescheduled by reschedule_task — restored on undo. */
  rescheduled?: { taskId: string; fromDate: string; fromTime: string };
};

export interface ActionRecord {
  id: string;
  kind: ActionKind;
  summary: string;
  createdAt: string;
  undoable: boolean;
  undone: boolean;
  snapshot: ActionSnapshot;
}

export interface PendingConfirmation {
  id: string;
  kind: ActionKind;
  message: string;
  createdAt: string;
  payload: Record<string, unknown>;
}


// ─── Tangents: your current work, and the lines that branch off it ───────────
// Path is a recursive tree rendered as circles and tangents. The goal sits at
// the centre; what you already have sits on the circle around it; each idea
// leaves the circle as a tangent at exactly one point; an idea you keep becomes
// the centre of the next circle. See lib/path-layout.ts for the geometry.

export type AnchorKind = "ec" | "award" | "course" | "project";

/** A branch is suggested until you act on it. */
export type TangentStatus = "suggested" | "accepted" | "done" | "dismissed";

/**
 * One node of the Path tree.
 *
 * The tree alternates by depth, which is what produces the drawing:
 *
 *   depth 0  the goal, at the centre of the first circle
 *   depth 1  work you already have, sitting ON that circle
 *   depth 2  ideas, each at the end of its own tangent off a piece of work
 *   depth 3  work on the circle that grew from an idea you kept
 *   ...and so on, forever.
 *
 * `kind` records which of those a node is so the API can validate a move
 * without walking to the root every time.
 */
export type PathNodeKind = "work" | "idea";

export type PathNode = {
  id: string;
  /** Which Path this node belongs to. Every node has exactly one. */
  pathId: string;
  /** null means it hangs off the goal, at the centre of the root circle. */
  parentId: string | null;
  kind: PathNodeKind;
  title: string;
  /** Work: your role or the result. Idea: the concrete move. */
  detail?: string;
  /** Ideas only: why this angle is worth the hours. */
  rationale?: string;
  /** Ideas only: the shape of the commitment, e.g. "2 hrs/wk for 6 weeks". */
  effort?: string;
  /** Work only. */
  category?: AnchorKind;
  hoursPerWeek?: number;
  years?: number;
  status: TangentStatus;
  /** Whether Tangent proposed it or you wrote it. */
  origin: "tangent" | "you";
  createdAt: string;
};

// Superseded by PathNode above. Retained so a workspace saved before the
// recursive model can be read once and migrated; nothing writes these.
export type LegacyAnchor = {
  id: string;
  title: string;
  kind: AnchorKind;
  detail?: string;
  hoursPerWeek?: number;
  years?: number;
  createdAt: string;
};

export type LegacyTangentIdea = {
  id: string;
  anchorId: string;
  title: string;
  rationale: string;
  effort: string;
  status: TangentStatus;
  origin: "tangent" | "you";
  createdAt: string;
};

/**
 * One Path: a single goal and the tree that grows toward it.
 *
 * Deliberately not college-specific. A Path is anything you can state a target
 * for and make progress against - a college, a job, a chess rating, a
 * certification. The intake below is the coaching-intake shape: where you are,
 * where you want to be, by when, and what you can actually give it. Those four
 * are what let Tangent judge whether a branch is worth your hours, and
 * `standing` is what the first circle gets populated from.
 */
export type PathGoalKind = "college" | "career" | "skill" | "other";

export type Path = {
  id: string;
  /** Short label, the one that rides on the sphere. "Georgia Tech", "2000 USCF". */
  title: string;
  kind: PathGoalKind;
  /** The target, stated so you could tell whether you hit it. */
  target: string;
  /** Where you are now. The honest version. */
  current: string;
  /** When you want it by. Free text, because "Fall 2027" is as real as a date. */
  deadline?: string;
  /** Hours a week you can actually give it, not what you wish. */
  hoursPerWeek?: number;
  /** What is in the way: money, access, location, age, anything. */
  constraints?: string;
  /** What you already have going for it. Seeds the first circle. */
  standing?: string;
  createdAt: string;
  updatedAt: string;
};

/** Superseded by Path. Kept so a workspace saved before multi-path can be read
 *  once and migrated into a single Path; nothing writes this. */
export type Goal = {
  /** The college you're aiming at. */
  college: string;
  /** Intended major or focus, when known. */
  focus?: string;
  updatedAt: string;
};
