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
  categoryId?: string | null;
  notes?: string;
  recurring?: RecurringConfig;
  resources?: Array<{ label: string; url: string }>;
  startAction?: string;
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

export type Category = {
  id: string;
  name: string;
  color: string;
  icon?: string;
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
  categories: Category[];
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

// Legacy command type kept for /api/commands route (calendar add event etc.)
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Command =
  | { type: "ADD_TASK"; title: string; date?: string; time?: string; kind?: TaskKind; dayOfWeek?: DayOfWeek; steps?: string[]; calendarId?: string | null }
  | { type: "UPDATE_TASK"; id: string; title?: string; date?: string; time?: string; kind?: TaskKind; dayOfWeek?: DayOfWeek; steps?: string[] }
  | { type: "REMOVE_TASK"; id: string }
  | { type: "ADD_CALENDAR"; name: string; category?: CalendarCategory; color?: string }
  | { type: "ADD_EVENT"; calendarId: string; title: string; date: string; time?: string; steps?: string[] }
  | { type: "UPDATE_USER"; displayName?: string; email?: string }
  | { type: "SET_WEEKLY_PLAN"; items: string[] };
