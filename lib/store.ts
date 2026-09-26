import "server-only";
import { getRequestContext } from "./request-context";
import type {
  Task,
  Plan,
  RecurringConfig,
  CalendarDef,
  CalendarEvent,
  UserProfile,
  AppState,
  VoiceLogEntry,
  ContextEntry,
  UserContext,
  Notification,
  ActionKind,
  ActionRecord,
  ActionSnapshot,
  PendingConfirmation,
  BriefConfig,
  CanvasFeedConfig,
  PendingBriefBatch,
  ChatMessage,
  ChatSession,
} from "./types";

export type { ChatMessage, ChatSession } from "./types";

// Every function here acts for the student in the current request context
// (see lib/request-context.ts) and throws if there is none. Queries filter by
// user_id explicitly on top of Row Level Security, so the service-role client
// used by cron jobs is scoped the same way.

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ids from the client or the AI that aren't UUIDs can't exist in the
 *  database, so they're treated as "not found" instead of a query error. */
function isUuid(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

function ctx() {
  const { db, userId } = getRequestContext();
  return { db, userId };
}

function fail(where: string, error: { message: string }): never {
  throw new Error(`[store] ${where}: ${error.message}`);
}

/** Supabase caps a response at 1000 rows; page through larger result sets. */
const PAGE = 1000;
async function selectAll<T>(
  where: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) fail(where, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

// ─── In-memory state for areas not yet moved to Supabase ─────────────────────
// Being replaced area by area. Shared across students until then.

type LegacyData = {
  user: UserProfile;
  weeklyPlan: string[];
  voiceLogs: VoiceLogEntry[];
  lastVoiceCommand: string | null;
  lastVoiceResponse: string | null;
  taskChats: Record<string, ChatMessage[]>;
  chatSessions: ChatSession[];
};

const g = global as typeof global & {
  __tangentLegacy?: LegacyData;
  __tangentUserContext?: UserContext;
  __tangentNotifications?: Notification[];
  __tangentActions?: ActionRecord[];
  __tangentPending?: PendingConfirmation[];
  __tangentBriefConfig?: BriefConfig | null;
  __tangentCanvasFeed?: CanvasFeedConfig | null;
  __tangentPendingBriefBatch?: PendingBriefBatch | null;
};
if (!g.__tangentLegacy) {
  g.__tangentLegacy = {
    user: { displayName: "Tangent User", email: "you@example.com" },
    weeklyPlan: [],
    voiceLogs: [],
    lastVoiceCommand: null,
    lastVoiceResponse: null,
    taskChats: {},
    chatSessions: [],
  };
}
const store: LegacyData = g.__tangentLegacy;
if (!g.__tangentUserContext) {
  g.__tangentUserContext = { entries: [], compressedSummary: "", lastUpdated: new Date().toISOString(), totalInteractions: 0 };
}
if (!g.__tangentNotifications) g.__tangentNotifications = [];
if (!g.__tangentActions) g.__tangentActions = [];
if (!g.__tangentPending) g.__tangentPending = [];
if (g.__tangentBriefConfig === undefined) g.__tangentBriefConfig = null;
if (g.__tangentCanvasFeed === undefined) g.__tangentCanvasFeed = null;
if (g.__tangentPendingBriefBatch === undefined) g.__tangentPendingBriefBatch = null;

// ─── Task rows ────────────────────────────────────────────────────────────────

type TaskRow = {
  id: string;
  title: string;
  date: string;
  time: string;
  completed: boolean;
  kind: Task["kind"] | null;
  calendar_id: string | null;
  plan_id: string | null;
  notes: string | null;
  recurring: RecurringConfig | null;
  resources: Task["resources"] | null;
  start_action: string | null;
  source: Task["source"] | null;
};

const TASK_COLUMNS =
  "id, title, date, time, completed, kind, calendar_id, plan_id, notes, recurring, resources, start_action, source";

function taskFromRow(r: TaskRow): Task {
  const t: Task = { id: r.id, title: r.title, date: r.date, time: r.time, completed: r.completed };
  if (r.kind) t.kind = r.kind;
  if (r.calendar_id !== null) t.calendarId = r.calendar_id;
  if (r.plan_id !== null) t.planId = r.plan_id;
  if (r.notes !== null) t.notes = r.notes;
  if (r.recurring) t.recurring = r.recurring;
  if (r.resources) t.resources = r.resources;
  if (r.start_action !== null) t.startAction = r.start_action;
  if (r.source) t.source = r.source;
  return t;
}

/** Maps a Task patch to column values. A key that is present but undefined
 *  clears the column, matching the old Object.assign behaviour. */
function taskPatchToRow(patch: Partial<Omit<Task, "id">>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const has = (k: keyof Task) => Object.prototype.hasOwnProperty.call(patch, k);
  if (has("title") && patch.title != null) row.title = patch.title;
  if (has("date") && patch.date != null) row.date = patch.date;
  if (has("time")) row.time = patch.time ?? "";
  if (has("completed") && patch.completed != null) row.completed = patch.completed;
  if (has("kind")) row.kind = patch.kind ?? null;
  if (has("calendarId")) row.calendar_id = patch.calendarId ?? null;
  if (has("planId")) row.plan_id = isUuid(patch.planId) ? patch.planId : null;
  if (has("notes")) row.notes = patch.notes ?? null;
  if (has("recurring")) row.recurring = patch.recurring ?? null;
  if (has("resources")) row.resources = patch.resources ?? null;
  if (has("startAction")) row.start_action = patch.startAction ?? null;
  if (has("source")) row.source = patch.source ?? null;
  return row;
}

function newTaskRow(userId: string, task: Omit<Task, "id">): Record<string, unknown> {
  return { user_id: userId, completed: false, ...taskPatchToRow({ ...task, time: task.time ?? "" }) };
}

async function selectTasks(where: string, filter?: (q: any) => any): Promise<Task[]> {
  const { db, userId } = ctx();
  const rows = await selectAll<TaskRow>(where, (from, to) => {
    let q = db.from("tasks").select(TASK_COLUMNS).eq("user_id", userId);
    if (filter) q = filter(q);
    return q.order("date").order("time").order("created_at").order("id").range(from, to);
  });
  return rows.map(taskFromRow);
}

async function getTask(id: string): Promise<Task | null> {
  if (!isUuid(id)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db.from("tasks").select(TASK_COLUMNS).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) fail("getTask", error);
  return data ? taskFromRow(data as TaskRow) : null;
}

/** Deletes tasks by id (chunked) and returns how many were removed. */
async function deleteTaskIds(where: string, ids: string[]): Promise<number> {
  const { db, userId } = ctx();
  const valid = ids.filter(isUuid);
  let removed = 0;
  for (let i = 0; i < valid.length; i += 200) {
    const { data, error } = await db
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .in("id", valid.slice(i, i + 200))
      .select("id");
    if (error) fail(where, error);
    removed += data?.length ?? 0;
  }
  return removed;
}

/** Re-inserts full task objects (undo of a delete) with their original ids.
 *  A task whose plan no longer exists comes back without the plan link. */
async function restoreTasks(tasks: Task[]): Promise<void> {
  const { db, userId } = ctx();
  const valid = tasks.filter((t) => isUuid(t.id));
  if (valid.length === 0) return;
  const planIds = Array.from(new Set(valid.map((t) => t.planId).filter(isUuid)));
  let livePlans = new Set<string>();
  if (planIds.length) {
    const { data, error } = await db.from("plans").select("id").eq("user_id", userId).in("id", planIds);
    if (error) fail("restoreTasks", error);
    livePlans = new Set((data ?? []).map((p: { id: string }) => p.id));
  }
  const rows = valid.map(({ id, ...rest }) => ({
    ...newTaskRow(userId, rest),
    id,
    completed: !!rest.completed,
    plan_id: rest.planId && livePlans.has(rest.planId) ? rest.planId : null,
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("tasks").upsert(rows.slice(i, i + 500), { onConflict: "id", ignoreDuplicates: true });
    if (error) fail("restoreTasks", error);
  }
}

// ─── Task functions ───────────────────────────────────────────────────────────

export async function getAllTasks(): Promise<Task[]> {
  return selectTasks("getAllTasks");
}

export async function getTasksByDate(date: string): Promise<Task[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
  return selectTasks("getTasksByDate", (q) => q.eq("date", date));
}

export async function getTasksByWeek(refDate?: string): Promise<Task[]> {
  const ref = refDate ? new Date(refDate + "T12:00:00") : new Date();
  const day = ref.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const start = monday.toISOString().slice(0, 10);
  const end = sunday.toISOString().slice(0, 10);
  return selectTasks("getTasksByWeek", (q) => q.gte("date", start).lte("date", end));
}

function titleTokenOverlap(a: string, b: string): number {
  const tokenize = (s: string) => Array.from(new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)));
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const tbSet = new Set(tb);
  const intersection = ta.filter((t) => tbSet.has(t)).length;
  const union = new Set(ta.concat(tb)).size;
  return union === 0 ? 0 : intersection / union;
}

function timeDiffMinutes(a: string, b: string): number {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  if ([ah, am, bh, bm].some((n) => Number.isNaN(n))) return Infinity;
  return Math.abs(ah * 60 + am - (bh * 60 + bm));
}

/** A non-completed task on the same date, within 30 minutes, whose title
 *  overlaps ≥80% (lowercased token Jaccard) with the given task — used by
 *  addTask to silently skip inserting near-identical duplicates. */
function findDuplicateIn(candidates: Task[], task: Omit<Task, "id">): Task | undefined {
  return candidates.find(
    (t) =>
      !t.completed &&
      t.date === task.date &&
      timeDiffMinutes(t.time, task.time) <= 30 &&
      titleTokenOverlap(t.title, task.title) >= 0.8
  );
}

export async function addTask(task: Omit<Task, "id">): Promise<Task & { wasDuplicate?: boolean }> {
  const { db, userId } = ctx();
  const sameDay = await selectTasks("addTask", (q) => q.eq("date", task.date).eq("completed", false));
  const duplicate = findDuplicateIn(sameDay, task);
  if (duplicate) {
    console.log("[store] addTask: skipped duplicate of", duplicate.id, duplicate.title);
    return { ...duplicate, wasDuplicate: true };
  }
  const { data, error } = await db.from("tasks").insert(newTaskRow(userId, task)).select(TASK_COLUMNS).single();
  if (error) fail("addTask", error);
  const created = taskFromRow(data as TaskRow);
  console.log("[store] addTask:", created.id, created.title, created.date, created.time, created.kind);
  return created;
}

export async function completeTask(id: string): Promise<Task | null> {
  const task = await updateTask(id, { completed: true });
  if (!task) console.log("[store] completeTask: not found", id);
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  const removed = await deleteTaskIds("deleteTask", [id]);
  if (!removed) console.log("[store] deleteTask: not found", id);
  return removed > 0;
}

export async function clearAllTasks(): Promise<void> {
  const { db, userId } = ctx();
  const { error, count } = await db.from("tasks").delete({ count: "exact" }).eq("user_id", userId);
  if (error) fail("clearAllTasks", error);
  console.log("[store] clearAllTasks — removed", count ?? 0, "tasks");
}

export async function toggleTask(id: string): Promise<Task | null> {
  const task = await getTask(id);
  if (!task) {
    console.log("[store] toggleTask: not found", id);
    return null;
  }
  return updateTask(id, { completed: !task.completed });
}

export async function updateTask(id: string, patch: Partial<Omit<Task, "id">>): Promise<Task | null> {
  if (!isUuid(id)) return null;
  const row = taskPatchToRow(patch);
  if (Object.keys(row).length === 0) return getTask(id);
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("tasks")
    .update(row)
    .eq("user_id", userId)
    .eq("id", id)
    .select(TASK_COLUMNS)
    .maybeSingle();
  if (error) fail("updateTask", error);
  if (!data) {
    console.log("[store] updateTask: not found", id);
    return null;
  }
  return taskFromRow(data as TaskRow);
}

// ─── Recurring task functions ─────────────────────────────────────────────────

export async function addRecurringTask(
  task: Omit<Task, "id">,
  recurring: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    daysOfWeek?: number[];
    endDate?: string;
    occurrences?: number;
  }
): Promise<Task[]> {
  const { db, userId } = ctx();
  const parentId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const startDate = new Date(task.date + "T12:00:00");
  const endDate = recurring.endDate
    ? new Date(recurring.endDate + "T12:00:00")
    : new Date(startDate.getFullYear(), 11, 31, 12, 0, 0);

  const currentDate = new Date(startDate);
  let count = 0;
  const maxOccurrences = recurring.occurrences ?? 365;
  const dates: string[] = [];

  console.log("[store] addRecurringTask start — parentId:", parentId, "| freq:", recurring.frequency, "| from:", task.date, "| to:", endDate.toISOString().slice(0, 10));

  while (currentDate <= endDate && count < maxOccurrences) {
    let shouldAdd = false;
    if (recurring.frequency === "daily") {
      shouldAdd = true;
    } else if (recurring.frequency === "weekly") {
      shouldAdd = !!recurring.daysOfWeek?.includes(currentDate.getDay());
    } else if (recurring.frequency === "monthly") {
      shouldAdd = currentDate.getDate() === startDate.getDate();
    } else if (recurring.frequency === "yearly") {
      shouldAdd = currentDate.getMonth() === startDate.getMonth() && currentDate.getDate() === startDate.getDate();
    }
    if (shouldAdd) {
      dates.push(currentDate.toISOString().slice(0, 10));
      count++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  if (dates.length === 0) return [];

  // One read for duplicate checks across the whole series, then a bulk insert.
  const existing = await selectTasks("addRecurringTask", (q) =>
    q.gte("date", dates[0]).lte("date", dates[dates.length - 1]).eq("completed", false)
  );
  const rec: RecurringConfig = {
    enabled: true,
    frequency: recurring.frequency,
    daysOfWeek: recurring.daysOfWeek,
    endDate: recurring.endDate,
    parentId,
  };
  const results: (Task & { wasDuplicate?: boolean })[] = [];
  const toInsert: { index: number; row: Record<string, unknown> }[] = [];
  for (const date of dates) {
    const instance = { ...task, date, recurring: rec };
    const duplicate = findDuplicateIn(existing, instance);
    if (duplicate) {
      results.push({ ...duplicate, wasDuplicate: true });
    } else {
      toInsert.push({ index: results.length, row: newTaskRow(userId, instance) });
      results.push(null as unknown as Task);
    }
  }
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const { data, error } = await db.from("tasks").insert(chunk.map((c) => c.row)).select(TASK_COLUMNS);
    if (error) fail("addRecurringTask", error);
    // Inserted rows come back in insert order.
    (data as TaskRow[]).forEach((r, k) => {
      results[chunk[k].index] = taskFromRow(r);
    });
  }

  console.log("[store] addRecurringTask done — created:", toInsert.length, "of", results.length, "instances for parentId:", parentId);
  return results;
}

export async function deleteRecurringTask(taskId: string, deleteAll: boolean): Promise<number> {
  const task = await getTask(taskId);
  if (!task) {
    console.log("[store] deleteRecurringTask: task not found", taskId);
    return 0;
  }
  if (deleteAll && task.recurring?.parentId) {
    const { db, userId } = ctx();
    const { data, error } = await db
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .eq("recurring_parent_id", task.recurring.parentId)
      .select("id");
    if (error) fail("deleteRecurringTask", error);
    console.log("[store] deleteRecurringTask all — parentId:", task.recurring.parentId, "| removed:", data?.length ?? 0);
    return data?.length ?? 0;
  }
  return deleteTaskIds("deleteRecurringTask", [taskId]);
}

export async function updateRecurringTask(
  taskId: string,
  patch: Partial<Omit<Task, "id" | "recurring">>,
  updateAll: boolean
): Promise<number> {
  const task = await getTask(taskId);
  if (!task) {
    console.log("[store] updateRecurringTask: task not found", taskId);
    return 0;
  }
  if (updateAll && task.recurring?.parentId) {
    const row = taskPatchToRow(patch);
    if (Object.keys(row).length === 0) return 0;
    const { db, userId } = ctx();
    const { data, error } = await db
      .from("tasks")
      .update(row)
      .eq("user_id", userId)
      .eq("recurring_parent_id", task.recurring.parentId)
      .select("id");
    if (error) fail("updateRecurringTask", error);
    console.log("[store] updateRecurringTask all — parentId:", task.recurring.parentId, "| updated:", data?.length ?? 0);
    return data?.length ?? 0;
  }
  return (await updateTask(taskId, patch)) ? 1 : 0;
}

export async function getRecurringTasks(): Promise<Record<string, Task[]>> {
  const groups: Record<string, Task[]> = {};
  for (const t of await selectTasks("getRecurringTasks", (q) => q.not("recurring_parent_id", "is", null))) {
    if (t.recurring?.enabled && t.recurring.parentId) {
      (groups[t.recurring.parentId] ??= []).push(t);
    }
  }
  return groups;
}

// ─── Voice log functions ──────────────────────────────────────────────────────

export async function getAllVoiceLogs(): Promise<VoiceLogEntry[]> {
  return [...store.voiceLogs];
}

export async function addVoiceLog(entry: Omit<VoiceLogEntry, "at">): Promise<void> {
  const log: VoiceLogEntry = { at: new Date().toISOString(), ...entry };
  store.voiceLogs.unshift(log);
  if (store.voiceLogs.length > 100) store.voiceLogs.length = 100;
  store.lastVoiceCommand = entry.text;
  store.lastVoiceResponse = entry.response;
  console.log("[store] addVoiceLog action:", entry.action, "| ok:", entry.ok, "| text:", entry.text);
}

// ─── Calendar functions ───────────────────────────────────────────────────────

const DEFAULT_CALENDAR_ORDER = ["cal_all", "cal_personal", "cal_work", "cal_study"];

export async function getAllCalendars(): Promise<CalendarDef[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("calendars")
    .select("id, name, category, color")
    .eq("user_id", userId)
    .order("created_at")
    .order("id");
  if (error) fail("getAllCalendars", error);
  const rank = (id: string) => {
    const i = DEFAULT_CALENDAR_ORDER.indexOf(id);
    return i === -1 ? DEFAULT_CALENDAR_ORDER.length : i;
  };
  return (data ?? [])
    .map((c: { id: string; name: string; category: string; color: string | null }) => {
      const cal: CalendarDef = { id: c.id, name: c.name, category: c.category };
      if (c.color) cal.color = c.color;
      return cal;
    })
    .sort((a, b) => rank(a.id) - rank(b.id));
}

/** Alias of getAllCalendars — used by calendar-intelligence code (voice-handler, voice-agent-tools). */
export async function getCalendars(): Promise<CalendarDef[]> {
  return getAllCalendars();
}

export async function addCalendar(name: string, color?: string): Promise<CalendarDef> {
  const { db, userId } = ctx();
  const cal: CalendarDef = {
    id: uid("cal"),
    name,
    category: name.toLowerCase().replace(/\s+/g, "_"),
    color: color ?? "#a78bfa",
  };
  const { error } = await db.from("calendars").insert({ user_id: userId, ...cal });
  if (error) fail("addCalendar", error);
  console.log("[store] addCalendar:", cal.id, cal.name);
  return cal;
}

export async function getTasksByCalendar(calendarId: string): Promise<Task[]> {
  return (await getAllTasks()).filter((t) => (t.calendarId ?? "cal_all") === calendarId);
}

type TaskFilter = { title?: string; calendarId?: string; dateRange?: { start: string; end: string } };

function matchesFilter(t: Task, filter: TaskFilter): boolean {
  const hasFilter = !!(filter.title || filter.calendarId || filter.dateRange);
  let matches = !hasFilter;
  if (filter.title) {
    const keyword = filter.title.trim().toLowerCase();
    if (keyword && t.title.toLowerCase().includes(keyword)) matches = true;
  }
  if (filter.calendarId) {
    if ((t.calendarId ?? "cal_all") === filter.calendarId) matches = true;
  }
  if (filter.dateRange) {
    if (t.date >= filter.dateRange.start && t.date <= filter.dateRange.end) matches = true;
  }
  return matches;
}

/** Moves all tasks matching the given filter to a different calendar. Returns the count moved. */
export async function moveTasksToCalendar(filter: TaskFilter, targetCalendarId: string): Promise<number> {
  const ids = (await getTasksMatchingFilter(filter)).map((t) => t.id);
  const { db, userId } = ctx();
  let moved = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await db
      .from("tasks")
      .update({ calendar_id: targetCalendarId })
      .eq("user_id", userId)
      .in("id", ids.slice(i, i + 200))
      .select("id");
    if (error) fail("moveTasksToCalendar", error);
    moved += data?.length ?? 0;
  }
  console.log("[store] moveTasksToCalendar:", JSON.stringify(filter), "->", targetCalendarId, "| moved:", moved);
  return moved;
}

/** Dry-run version of moveTasksToCalendar's matching logic — used to preview
 *  affected tasks (for confirm-tier gating and undo snapshots) before mutating. */
export async function getTasksMatchingFilter(filter: TaskFilter): Promise<Task[]> {
  return (await getAllTasks()).filter((t) => matchesFilter(t, filter));
}

// ─── Event functions ──────────────────────────────────────────────────────────
// Standalone events were never shown in the UI and have no table; kept so the
// AppState shape doesn't change.

export async function addEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  return { id: uid("ev"), ...event };
}

// ─── User / plan functions ────────────────────────────────────────────────────

export async function updateUser(patch: Partial<UserProfile>): Promise<void> {
  if (patch.displayName !== undefined) store.user.displayName = patch.displayName;
  if (patch.email !== undefined) store.user.email = patch.email;
}

export async function setWeeklyPlan(items: string[]): Promise<void> {
  store.weeklyPlan = [...items];
}

// ─── Plan functions ───────────────────────────────────────────────────────────

const PLAN_COLORS = ["#38bdf8", "#f472b6", "#fb923c", "#818cf8", "#e879f9", "#06b6d4", "#84cc16"];

type PlanRow = {
  id: string;
  title: string;
  description: string;
  task_ids: string[];
  task_count: number;
  color: string;
  created_at: string;
};

function planFromRow(r: PlanRow): Plan {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    taskIds: [...(r.task_ids ?? [])],
    color: r.color,
    createdAt: r.created_at,
    taskCount: r.task_count,
  };
}

export async function getAllPlans(): Promise<Plan[]> {
  const { db, userId } = ctx();
  const rows = await selectAll<PlanRow>("getAllPlans", (from, to) =>
    db.from("plans").select("*").eq("user_id", userId).order("created_at").order("id").range(from, to)
  );
  return rows.map(planFromRow);
}

export async function addPlan(plan: Omit<Plan, "id" | "createdAt" | "color">): Promise<Plan> {
  const { db, userId } = ctx();
  const { count, error: countError } = await db
    .from("plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) fail("addPlan", countError);
  const { data, error } = await db
    .from("plans")
    .insert({
      user_id: userId,
      title: plan.title,
      description: plan.description ?? "",
      task_ids: plan.taskIds.filter(isUuid),
      task_count: plan.taskCount,
      color: PLAN_COLORS[(count ?? 0) % PLAN_COLORS.length],
    })
    .select("*")
    .single();
  if (error) fail("addPlan", error);
  const newPlan = planFromRow(data as PlanRow);
  console.log("[store] addPlan:", newPlan.id, newPlan.title, "tasks:", newPlan.taskIds.length);
  return newPlan;
}

export async function deletePlan(planId: string): Promise<boolean> {
  if (!isUuid(planId)) return false;
  const { db, userId } = ctx();
  const { data, error } = await db.from("plans").delete().eq("user_id", userId).eq("id", planId).select("id");
  if (error) fail("deletePlan", error);
  if (!data?.length) return false;
  console.log("[store] deletePlan:", planId);
  return true;
}

// ─── Task chat functions ──────────────────────────────────────────────────────

export async function getTaskChat(taskId: string): Promise<ChatMessage[]> {
  return (store.taskChats[taskId] ?? []).map((m) => ({ ...m }));
}

export async function addTaskChatMessage(taskId: string, role: "user" | "assistant", content: string): Promise<ChatMessage> {
  if (!store.taskChats[taskId]) store.taskChats[taskId] = [];
  const msg: ChatMessage = { role, content, timestamp: new Date().toISOString() };
  store.taskChats[taskId].push(msg);
  if (store.taskChats[taskId].length > 200) store.taskChats[taskId].splice(0, 1);
  console.log("[store] addTaskChatMessage:", taskId, role, content.slice(0, 60));
  return { ...msg };
}

// ─── Chat session functions ───────────────────────────────────────────────────

function copySession(s: ChatSession): ChatSession {
  return { ...s, messages: s.messages.map((m) => ({ ...m })) };
}

export async function getAllChatSessions(): Promise<ChatSession[]> {
  return store.chatSessions.map(copySession);
}

export async function createChatSession(title?: string): Promise<ChatSession> {
  const session: ChatSession = {
    id: uid("sess"),
    title: title ?? `Chat ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.chatSessions.unshift(session);
  if (store.chatSessions.length > 50) store.chatSessions.length = 50;
  console.log("[store] createChatSession:", session.id, session.title);
  return { ...session, messages: [] };
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const s = store.chatSessions.find((s) => s.id === sessionId);
  return s ? copySession(s) : null;
}

export async function addChatSessionMessage(sessionId: string, role: "user" | "assistant", content: string): Promise<ChatMessage | null> {
  const session = store.chatSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const msg: ChatMessage = { role, content, timestamp: new Date().toISOString() };
  session.messages.push(msg);
  session.updatedAt = new Date().toISOString();
  if (session.messages.length > 200) session.messages.splice(0, 1);
  return { ...msg };
}

export async function renameChatSession(sessionId: string, title: string): Promise<boolean> {
  const session = store.chatSessions.find((s) => s.id === sessionId);
  if (!session) return false;
  session.title = title.trim() || session.title;
  session.updatedAt = new Date().toISOString();
  return true;
}

/** Sets a chat's user-chosen highlight color (null clears it) and/or pin state. */
export async function styleChatSession(
  sessionId: string,
  style: { color?: string | null; pinned?: boolean }
): Promise<ChatSession | null> {
  const session = store.chatSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  if (style.color !== undefined) session.color = style.color;
  if (style.pinned !== undefined) session.pinned = style.pinned;
  return copySession(session);
}

/** Links a chat to the tasks/plan an action touched (read from the action's
 *  undo snapshot), or to explicit ids. Links accumulate across the chat. */
export async function linkChatSession(
  sessionId: string,
  link: { actionId?: string; taskIds?: string[]; planId?: string | null }
): Promise<ChatSession | null> {
  const session = store.chatSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const taskIds = new Set(session.taskIds ?? []);
  let planId = session.planId ?? null;

  if (link.actionId) {
    const snap = g.__tangentActions!.find((a) => a.id === link.actionId)?.snapshot;
    if (snap) {
      if (snap.addedPlanId) planId = snap.addedPlanId;
      for (const id of snap.addedTaskIds ?? []) taskIds.add(id);
      if (snap.completedTaskId) taskIds.add(snap.completedTaskId);
      if (snap.rescheduled) taskIds.add(snap.rescheduled.taskId);
      for (const m of snap.moves ?? []) taskIds.add(m.taskId);
    }
  }
  for (const id of link.taskIds ?? []) taskIds.add(id);
  if (link.planId) planId = link.planId;

  session.taskIds = Array.from(taskIds);
  session.planId = planId;
  return copySession(session);
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  const idx = store.chatSessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;
  store.chatSessions.splice(idx, 1);
  console.log("[store] deleteChatSession:", sessionId);
  return true;
}

// ─── Full state helpers ───────────────────────────────────────────────────────

export async function getAppState(): Promise<AppState> {
  const [tasks, calendars, plans] = await Promise.all([getAllTasks(), getAllCalendars(), getAllPlans()]);
  return {
    tasks,
    calendars,
    events: [],
    user: { ...store.user },
    weeklyPlan: [...store.weeklyPlan],
    lastVoiceCommand: store.lastVoiceCommand,
    lastVoiceResponse: store.lastVoiceResponse,
    plans,
  };
}

export async function getState(): Promise<AppState> {
  return getAppState();
}

/** Saves the profile parts of a client-sent state. Tasks, plans and calendars
 *  are only changed through their own endpoints, so a stale client can't
 *  overwrite them. */
export async function replaceState(next: Partial<AppState>): Promise<void> {
  if (next.user) await updateUser(next.user);
  if (Array.isArray(next.weeklyPlan)) await setWeeklyPlan(next.weeklyPlan);
}

// ─── User context functions ───────────────────────────────────────────────────

export async function getUserContext(): Promise<UserContext> {
  return g.__tangentUserContext!;
}

export async function addContextEntry(entry: Omit<ContextEntry, "id" | "timestamp">): Promise<ContextEntry> {
  const full: ContextEntry = {
    ...entry,
    id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  g.__tangentUserContext!.entries.push(full);
  g.__tangentUserContext!.lastUpdated = new Date().toISOString();
  g.__tangentUserContext!.totalInteractions++;
  console.log("[store] Context entry added:", full.category, full.fact.slice(0, 60));
  return full;
}

export async function getContextAsString(): Promise<string> {
  const c = g.__tangentUserContext!;
  const entries = c.entries
    .slice(-50) // last 50 entries max
    .map((e) => `[${e.category}] ${e.fact}`)
    .join("\n");

  if (c.compressedSummary) {
    return `COMPRESSED HISTORY:\n${c.compressedSummary}\n\nRECENT:\n${entries}`;
  }
  return entries || "No user context yet.";
}

export async function setCompressedSummary(summary: string): Promise<void> {
  g.__tangentUserContext!.compressedSummary = summary;
  // Keep only last 10 entries after compression
  g.__tangentUserContext!.entries = g.__tangentUserContext!.entries.slice(-10);
  console.log("[store] Context compressed. Summary length:", summary.length);
}

// ─── Notification functions ───────────────────────────────────────────────────

export async function getNotifications(): Promise<Notification[]> {
  return g.__tangentNotifications!
    .filter((n) => !n.dismissed)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function addNotification(notif: Omit<Notification, "id" | "timestamp" | "read" | "dismissed">): Promise<Notification> {
  // Dedup by task + type: proactive checks run on every page load AND on a cron
  // schedule, so without this the same overdue/reschedule nudge for one task can
  // stack up every time either trigger fires while it's still unresolved.
  const taskId = notif.actionData?.taskId;
  if (taskId) {
    const existing = g.__tangentNotifications!.find(
      (n) => !n.dismissed && n.type === notif.type && n.actionData?.taskId === taskId
    );
    if (existing) {
      console.log("[store] Notification deduped:", notif.type, taskId);
      return existing;
    }
  }
  const full: Notification = {
    ...notif,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    read: false,
    dismissed: false,
  };
  g.__tangentNotifications!.unshift(full);
  // Keep max 50 notifications
  if (g.__tangentNotifications!.length > 50) {
    g.__tangentNotifications = g.__tangentNotifications!.slice(0, 50);
  }
  console.log("[store] Notification added:", full.type, full.title);
  return full;
}

export async function markNotificationRead(id: string): Promise<void> {
  const n = g.__tangentNotifications!.find((n) => n.id === id);
  if (n) n.read = true;
}

export async function dismissNotification(id: string): Promise<void> {
  const n = g.__tangentNotifications!.find((n) => n.id === id);
  if (n) n.dismissed = true;
}

export async function getUnreadNotificationCount(): Promise<number> {
  return g.__tangentNotifications!.filter((n) => !n.read && !n.dismissed).length;
}

// ─── Action Receipts + Undo ────────────────────────────────────────────────

export async function recordAction(
  kind: ActionKind,
  summary: string,
  snapshot: ActionSnapshot,
  undoable = true
): Promise<ActionRecord> {
  const record: ActionRecord = {
    id: uid("act"),
    kind,
    summary,
    createdAt: new Date().toISOString(),
    undoable,
    undone: false,
    snapshot,
  };
  g.__tangentActions!.unshift(record);
  if (g.__tangentActions!.length > 50) {
    g.__tangentActions = g.__tangentActions!.slice(0, 50);
  }
  console.log("[store] recordAction:", record.id, kind, "-", summary);
  return { ...record };
}

export async function getRecentActions(limit = 20): Promise<ActionRecord[]> {
  return g.__tangentActions!.slice(0, limit).map((a) => ({ ...a, snapshot: { ...a.snapshot } }));
}

export async function undoAction(id: string): Promise<{ ok: boolean; message: string }> {
  const record = g.__tangentActions!.find((a) => a.id === id);
  if (!record) return { ok: false, message: "That action could not be found." };
  if (record.undone) return { ok: false, message: "Already undone." };
  if (!record.undoable) return { ok: false, message: "This action can't be undone." };

  await applyUndo(record);

  record.undone = true;
  console.log("[store] undoAction:", id, record.kind);
  return { ok: true, message: "Undone." };
}

async function applyUndo(record: ActionRecord): Promise<void> {
  const snap = record.snapshot;
  switch (record.kind) {
    case "add_task":
    case "create_plan":
    case "add_recurring_task": {
      await deleteTaskIds("undoAction", snap.addedTaskIds ?? []);
      if (snap.addedPlanId) await deletePlan(snap.addedPlanId);
      break;
    }
    case "delete_task":
    case "delete_all_tasks": {
      await restoreTasks(snap.removedTasks ?? []);
      break;
    }
    case "complete_task": {
      if (snap.completedTaskId) await updateTask(snap.completedTaskId, { completed: false });
      break;
    }
    case "move_tasks": {
      for (const move of snap.moves ?? []) {
        await updateTask(move.taskId, { calendarId: move.fromCalendarId });
      }
      break;
    }
    case "reschedule_task": {
      const r = snap.rescheduled;
      if (r) await updateTask(r.taskId, { date: r.fromDate, time: r.fromTime });
      break;
    }
  }
}

// ─── Confirm-tier gating (delete_all_tasks, large move_tasks) ────────────────

export async function addPendingConfirmation(
  kind: ActionKind,
  message: string,
  payload: Record<string, unknown>
): Promise<PendingConfirmation> {
  const pending: PendingConfirmation = {
    id: uid("pend"),
    kind,
    message,
    createdAt: new Date().toISOString(),
    payload,
  };
  g.__tangentPending!.push(pending);
  if (g.__tangentPending!.length > 20) {
    g.__tangentPending = g.__tangentPending!.slice(-20);
  }
  console.log("[store] addPendingConfirmation:", pending.id, kind, "-", message);
  return pending;
}

export async function getPendingConfirmation(id: string): Promise<PendingConfirmation | null> {
  return g.__tangentPending!.find((p) => p.id === id) ?? null;
}

export async function resolvePendingConfirmation(id: string): Promise<void> {
  g.__tangentPending = g.__tangentPending!.filter((p) => p.id !== id);
}

// ─── Daily Brief config ───────────────────────────────────────────────────────

export async function getBriefConfig(): Promise<BriefConfig | null> {
  const cfg = g.__tangentBriefConfig;
  return cfg ? { ...cfg, sources: cfg.sources.map((s) => ({ ...s })) } : null;
}

export async function saveBriefConfig(config: BriefConfig): Promise<BriefConfig> {
  g.__tangentBriefConfig = { ...config, sources: config.sources.map((s) => ({ ...s })) };
  console.log("[store] saveBriefConfig — sources:", config.sources.length, "| cadence:", config.cadence, "| time:", config.deliveryTime);
  return (await getBriefConfig())!;
}

// Tracks an in-flight Anthropic Message Batch submitted by the daily-brief cron job
// (see app/api/cron/daily-brief/route.ts) so the next cron tick knows to poll for the
// result instead of resubmitting.
export async function getPendingBriefBatch(): Promise<PendingBriefBatch | null> {
  return g.__tangentPendingBriefBatch ? { ...g.__tangentPendingBriefBatch } : null;
}

export async function setPendingBriefBatch(batch: PendingBriefBatch | null): Promise<void> {
  g.__tangentPendingBriefBatch = batch;
  console.log("[store] setPendingBriefBatch:", batch ? `${batch.batchId} (submitted ${batch.submittedAt})` : "cleared");
}

// ─── Canvas .ics feed connection ──────────────────────────────────────────────

export async function getCanvasFeed(): Promise<CanvasFeedConfig | null> {
  return g.__tangentCanvasFeed ? { ...g.__tangentCanvasFeed } : null;
}

export async function saveCanvasFeed(icsUrl: string): Promise<CanvasFeedConfig> {
  const config: CanvasFeedConfig = {
    icsUrl,
    connectedAt: new Date().toISOString(),
    lastSyncedAt: null,
    lastSyncCount: 0,
  };
  g.__tangentCanvasFeed = config;
  console.log("[store] saveCanvasFeed: connected");
  return { ...config };
}

export async function recordCanvasSync(count: number): Promise<CanvasFeedConfig | null> {
  if (!g.__tangentCanvasFeed) return null;
  g.__tangentCanvasFeed.lastSyncedAt = new Date().toISOString();
  g.__tangentCanvasFeed.lastSyncCount = count;
  console.log("[store] recordCanvasSync — count:", count);
  return { ...g.__tangentCanvasFeed };
}
