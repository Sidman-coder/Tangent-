import "server-only";
import { getRequestContext, requestMemo, forgetMemo } from "./request-context";
import { DEFAULT_TIMEZONE, isValidTimezone } from "./dates";
import { addDaysYMD, expandRecurrence, getUserToday, weekRange } from "./time";
import { preferencesFrom } from "./onboarding";
import type { OnboardingPreferences, OnboardingSubmission, PreferencesPatch, SchoolHours } from "./onboarding";
import { SCHOOL_SERIES_WEEKS, planSchoolReplace, schoolHoursFromTasks } from "./school-block";
import { CALENDARS, calendarGroupOf } from "./calendars";
import { DEFAULT_CAPACITY, type Capacity } from "./load";
import { decryptFeedUrl, encryptFeedUrl, maskCanvasFeedUrl as maskFeedUrl } from "./canvas-feed-security";
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
  CanvasFeedStatus,
  PendingBriefBatch,
  ChatMessage,
  ChatMessageRefs,
  ChatSession,
  Path,
  PathNode,
  TangentStatus,
  BatchUndoStep,
} from "./types";
import { parseChangeSet } from "./pipeline/changeset";
import type { ChangeSet, ChangeSetStatus } from "./pipeline/changeset";

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

/** Postgres returns "…+00:00"; the UI compares ISO strings, so normalise to "…Z". */
function iso(ts: string): string {
  return new Date(ts).toISOString();
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
  external_id: string | null;
  path_node_id: string | null;
};

const TASK_COLUMNS =
  "id, title, date, time, completed, kind, calendar_id, plan_id, notes, recurring, resources, start_action, source, external_id, path_node_id";

function taskFromRow(r: TaskRow): Task {
  const t: Task = { id: r.id, title: r.title, date: r.date, time: r.time, completed: r.completed };
  if (r.kind) t.kind = r.kind;
  if (r.plan_id !== null) t.planId = r.plan_id;
  if (r.notes !== null) t.notes = r.notes;
  if (r.recurring) t.recurring = r.recurring;
  if (r.resources) t.resources = r.resources;
  if (r.start_action !== null) t.startAction = r.start_action;
  if (r.source) t.source = r.source;
  if (r.external_id !== null) t.externalId = r.external_id;
  if (r.path_node_id !== null) t.pathNodeId = r.path_node_id;
  // Old ids (Personal/Work/Study/custom) become School or No school here, so
  // nothing above the store sees them (lib/calendars.ts).
  t.calendarId = calendarGroupOf({ ...t, calendarId: r.calendar_id ?? undefined });
  return t;
}

/** Maps a Task patch to column values. A key that is present but undefined
 *  clears the column, matching the old Object.assign behaviour. pathNodeId is
 *  deliberately absent: only addPathTask sets the link (and restoreTasks puts
 *  it back), so no ordinary edit, copy or AI-written task can change it. */
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
  if (has("externalId")) row.external_id = patch.externalId ?? null;
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
 *  A task whose plan or Path node no longer exists comes back without that
 *  link. So does an open path step whose node has since been given another
 *  open step: the database allows one open step per node. */
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
  const nodeIds = Array.from(new Set(valid.map((t) => t.pathNodeId).filter(isUuid)));
  let liveNodes = new Set<string>();
  const takenNodes = new Set<string>();
  if (nodeIds.length) {
    const [nodes, open] = await Promise.all([
      db.from("path_nodes").select("id").eq("user_id", userId).in("id", nodeIds),
      db.from("tasks").select("path_node_id").eq("user_id", userId).eq("completed", false).in("path_node_id", nodeIds),
    ]);
    if (nodes.error) fail("restoreTasks", nodes.error);
    if (open.error) fail("restoreTasks", open.error);
    liveNodes = new Set((nodes.data ?? []).map((n: { id: string }) => n.id));
    for (const r of (open.data ?? []) as { path_node_id: string }[]) takenNodes.add(r.path_node_id);
  }
  const pathNodeFor = (t: Omit<Task, "id">): string | null => {
    if (!t.pathNodeId || !liveNodes.has(t.pathNodeId)) return null;
    if (t.completed) return t.pathNodeId;
    if (takenNodes.has(t.pathNodeId)) return null;
    takenNodes.add(t.pathNodeId);
    return t.pathNodeId;
  };
  const rows = valid.map(({ id, ...rest }) => ({
    ...newTaskRow(userId, rest),
    id,
    completed: !!rest.completed,
    plan_id: rest.planId && livePlans.has(rest.planId) ? rest.planId : null,
    path_node_id: pathNodeFor(rest),
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
  const ref = refDate && /^\d{4}-\d{2}-\d{2}$/.test(refDate) ? refDate : getUserToday(await getUserTimezone());
  const { start, end } = weekRange(ref);
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

/** Titles of the given tasks that addTask would skip as duplicates of the
 *  student's open tasks today. Read-only; the preview shows it before confirm. */
export async function likelyDuplicateTitles(tasks: ReadonlyArray<Omit<Task, "id">>): Promise<string[]> {
  if (tasks.length === 0) return [];
  const open = (await getAllTasks()).filter((t) => !t.completed);
  return tasks.filter((t) => findDuplicateIn(open, t)).map((t) => t.title);
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

type DbError = { code?: string; message: string };

/** The partial unique index that allows one open step per Path node. */
function isActivePathStepConflict(error: DbError): boolean {
  return error.code === "23505" && error.message.includes("tasks_path_node_active_idx");
}

/** Creates the scheduled first step of a Path node, linked to it. Unlike
 *  addTask there is no near-duplicate matching: the student picked this exact
 *  step and time, so handing back some other similar task would be wrong. The
 *  database allows one open step per node; if one already exists (a double
 *  click, another tab) this returns "already_scheduled" instead of throwing. */
export async function addPathTask(
  task: Omit<Task, "id" | "pathNodeId" | "pathOrigin">,
  pathNodeId: string
): Promise<{ task: Task } | { error: "already_scheduled" | "no_node" }> {
  if (!isUuid(pathNodeId)) return { error: "no_node" };
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("tasks")
    .insert({ ...newTaskRow(userId, task), path_node_id: pathNodeId })
    .select(TASK_COLUMNS)
    .single();
  if (error) {
    if (isActivePathStepConflict(error)) return { error: "already_scheduled" };
    // Foreign key: the node is gone (or was never this student's).
    if ((error as DbError).code === "23503") return { error: "no_node" };
    fail("addPathTask", error);
  }
  const created = taskFromRow(data as TaskRow);
  console.log("[store] addPathTask:", created.id, created.title, created.date, created.time, "node", pathNodeId);
  return { task: created };
}

/** Every task that came from the given Path nodes, completed ones included.
 *  A node's scheduled state on the Path view is derived from these. */
export async function getPathNodeTasks(nodeIds: string[]): Promise<Task[]> {
  const ids = nodeIds.filter(isUuid);
  const out: Task[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    out.push(...(await selectTasks("getPathNodeTasks", (q) => q.in("path_node_id", chunk))));
  }
  return out;
}

/** Tasks dated within [start, end], for finding open times. */
export async function getTasksBetween(start: string, end: string): Promise<Task[]> {
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(start) || !ymd.test(end)) return [];
  return selectTasks("getTasksBetween", (q) => q.gte("date", start).lte("date", end));
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

/** Deletes these tasks (the student's own only). Returns how many were removed. */
export async function deleteTasks(ids: string[]): Promise<number> {
  return deleteTaskIds("deleteTasks", ids);
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
  const run = (r: Record<string, unknown>) =>
    db.from("tasks").update(r).eq("user_id", userId).eq("id", id).select(TASK_COLUMNS).maybeSingle();
  let { data, error } = await run(row);
  // Reopening an old path step while its node already has another open step
  // would break the one-open-step rule. The reopened task stays, as an
  // ordinary task without the link.
  if (error && isActivePathStepConflict(error)) {
    console.log("[store] updateTask: reopened path step unlinked, node already has an open step", id);
    ({ data, error } = await run({ ...row, path_node_id: null }));
  }
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
  const dates = expandRecurrence(task.date, recurring);
  console.log("[store] addRecurringTask start — parentId:", parentId, "| freq:", recurring.frequency, "| from:", task.date, "| instances:", dates.length);
  if (dates.length === 0) return [];

  // One read for duplicate checks across the whole series, then a bulk insert.
  const existing = await selectTasks("addRecurringTask", (q) =>
    q.gte("date", dates[0]).lte("date", dates[dates.length - 1]).eq("completed", false)
  );
  // Weekly with no day picked means the day the series starts on (see
  // expandRecurrence). Store that day so the task reads "Every Monday".
  const daysOfWeek =
    recurring.frequency === "weekly" && !recurring.daysOfWeek?.length
      ? [new Date(`${task.date}T12:00:00Z`).getUTCDay()]
      : recurring.daysOfWeek;
  const rec: RecurringConfig = {
    enabled: true,
    frequency: recurring.frequency,
    daysOfWeek,
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

const MAX_VOICE_LOGS = 100;

export async function getAllVoiceLogs(): Promise<VoiceLogEntry[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("voice_logs")
    .select("at, text, response, action, ok")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .limit(MAX_VOICE_LOGS);
  if (error) fail("getAllVoiceLogs", error);
  return (data ?? []).map((r: VoiceLogEntry) => ({ ...r, at: iso(r.at) }));
}

export async function addVoiceLog(entry: Omit<VoiceLogEntry, "at">): Promise<void> {
  const { db, userId } = ctx();
  const { error } = await db
    .from("voice_logs")
    .insert({ user_id: userId, text: entry.text, response: entry.response, action: entry.action, ok: entry.ok });
  if (error) fail("addVoiceLog", error);
  await updateProfile("addVoiceLog", { last_voice_command: entry.text, last_voice_response: entry.response });

  const { data: old, error: oldError } = await db
    .from("voice_logs")
    .select("id")
    .eq("user_id", userId)
    .order("id", { ascending: false })
    .range(MAX_VOICE_LOGS, MAX_VOICE_LOGS + PAGE - 1);
  if (oldError) fail("addVoiceLog", oldError);
  const oldIds = (old ?? []).map((r: { id: number }) => r.id);
  if (oldIds.length) {
    const { error: delError } = await db.from("voice_logs").delete().eq("user_id", userId).in("id", oldIds);
    if (delError) fail("addVoiceLog", delError);
  }
  console.log("[store] addVoiceLog action:", entry.action, "| ok:", entry.ok, "| text:", entry.text);
}

// ─── Calendar functions ───────────────────────────────────────────────────────

const DEFAULT_CALENDAR_ORDER = ["cal_all", "cal_personal", "cal_work", "cal_study"];

export async function getAllCalendars(): Promise<CalendarDef[]> {
  return requestMemo("calendars", readCalendars);
}

// Fixed: All, School, No school (lib/calendars.ts). The calendars table is no
// longer read; its rows are left in place for older tasks' ids.
async function readCalendars(): Promise<CalendarDef[]> {
  return CALENDARS.map((c) => ({ ...c }));
}

/** Alias of getAllCalendars — used by calendar-intelligence code (voice-handler, voice-agent-tools). */
export async function getCalendars(): Promise<CalendarDef[]> {
  return getAllCalendars();
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

// ─── Profile (user, weekly plan, onboarding, timezone) ────────────────────────

type ProfileRow = {
  display_name: string;
  email: string;
  is_high_school: boolean | null;
  onboarded_at: string | null;
  timezone: string;
  weekly_plan: string[];
  last_voice_command: string | null;
  last_voice_response: string | null;
  context_summary: string;
  context_interactions: number;
  context_updated_at: string;
  // Onboarding answers (migration 20260929000000). Absent on a database the
  // migration hasn't reached yet; see getProfileRow.
  help_focus?: string | null;
  slip_point?: string | null;
  day_view?: string | null;
  working_toward?: string | null;
  starting_intent?: string | null;
};

const LEGACY_PROFILE_COLUMNS =
  "display_name, email, is_high_school, onboarded_at, timezone, weekly_plan, last_voice_command, last_voice_response, context_summary, context_interactions, context_updated_at";
const PROFILE_COLUMNS = `${LEGACY_PROFILE_COLUMNS}, help_focus, slip_point, day_view, working_toward, starting_intent`;

/** Postgres "undefined_column": the onboarding migration isn't applied yet. */
function isMissingColumn(error: { code?: string; message: string }): boolean {
  return error.code === "42703" || /column .* does not exist/i.test(error.message);
}

async function getProfileRow(where: string): Promise<ProfileRow> {
  const { db, userId } = ctx();
  let { data, error } = await db.from("profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  // The migration must ship before this code, but if it hasn't, reading the
  // profile should not take the whole app down: answers read as unanswered
  // (default behavior) and only saving them fails.
  if (error && isMissingColumn(error)) {
    console.warn("[store] profiles is missing the onboarding columns; apply migration 20260929000000");
    ({ data, error } = await db.from("profiles").select(LEGACY_PROFILE_COLUMNS).eq("user_id", userId).maybeSingle());
  }
  if (error) fail(where, error);
  if (!data) throw new Error(`[store] ${where}: no profile for this student`);
  return data as ProfileRow;
}

async function updateProfile(where: string, row: Record<string, unknown>): Promise<void> {
  const { db, userId } = ctx();
  const { error } = await db.from("profiles").update(row).eq("user_id", userId);
  if (error) fail(where, error);
  if ("timezone" in row) forgetMemo("timezone");
}

// ─── Daily capacity (spacing brain) ─────────────────────────────────────────
// Read on its own, not in PROFILE_COLUMNS: until migration
// 20261010000000_profile_daily_capacity is applied the columns don't exist, and
// a missing column must not take the whole profile down with it.

/** The student's saved capacity, or null if never answered (or the columns
 *  aren't there yet). */
export async function getCapacity(): Promise<Capacity | null> {
  return requestMemo("capacity", async () => {
    const { db, userId } = ctx();
    const { data, error } = await db
      .from("profiles")
      .select("capacity_weekday_min, capacity_weekend_min")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { capacity_weekday_min: number | null; capacity_weekend_min: number | null };
    if (row.capacity_weekday_min === null && row.capacity_weekend_min === null) return null;
    return {
      weekday: row.capacity_weekday_min ?? DEFAULT_CAPACITY.weekday,
      weekend: row.capacity_weekend_min ?? DEFAULT_CAPACITY.weekend,
    };
  });
}

/** Saves capacity; false when the columns don't exist yet (not applied). */
export async function setCapacity(cap: Capacity): Promise<boolean> {
  const { db, userId } = ctx();
  const { error } = await db
    .from("profiles")
    .update({ capacity_weekday_min: Math.round(cap.weekday), capacity_weekend_min: Math.round(cap.weekend) })
    .eq("user_id", userId);
  forgetMemo("capacity");
  if (error) {
    console.warn("[store] setCapacity:", error.message);
    return false;
  }
  return true;
}

function userFromRow(r: ProfileRow): UserProfile {
  return {
    displayName: r.display_name,
    email: r.email,
    isHighSchool: r.is_high_school,
    onboardedAt: r.onboarded_at ? iso(r.onboarded_at) : null,
    timezone: isValidTimezone(r.timezone) ? r.timezone : DEFAULT_TIMEZONE,
    ...preferencesFrom({
      helpFocus: r.help_focus,
      slipPoint: r.slip_point,
      dayView: r.day_view,
      workingToward: r.working_toward,
      startingIntent: r.starting_intent,
    }),
  };
}

function preferencesToRow(prefs: Partial<OnboardingPreferences>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("helpFocus" in prefs) row.help_focus = prefs.helpFocus ?? null;
  if ("slipPoint" in prefs) row.slip_point = prefs.slipPoint ?? null;
  if ("dayView" in prefs) row.day_view = prefs.dayView ?? null;
  if ("workingToward" in prefs) row.working_toward = prefs.workingToward ?? null;
  if ("startingIntent" in prefs) row.starting_intent = prefs.startingIntent ?? null;
  return row;
}

/** Saves the editable profile fields. The email comes from the sign-in account
 *  and is not editable here (cron jobs check it against the allowlist). */
export async function updateUser(patch: Partial<UserProfile>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (typeof patch.displayName === "string") row.display_name = patch.displayName.trim().slice(0, 100);
  if (patch.timezone !== undefined && isValidTimezone(patch.timezone)) row.timezone = patch.timezone;
  if (Object.keys(row).length) await updateProfile("updateUser", row);
}

export async function setWeeklyPlan(items: string[]): Promise<void> {
  await updateProfile("setWeeklyPlan", { weekly_plan: items.filter((i) => typeof i === "string") });
}

/** Marks onboarding done and saves every answer in one go: the profile
 *  preferences and the School block. Safe to run any number of times (Redo
 *  setup): the School block is replaced, never added to. */
export async function completeOnboarding(answers: OnboardingSubmission): Promise<UserProfile> {
  const timezone = isValidTimezone(answers.timezone) ? answers.timezone : DEFAULT_TIMEZONE;
  // School first: if it fails, onboarding stays open and can simply be retried.
  await replaceSchoolBlock(answers.school, timezone);
  const row: Record<string, unknown> = {
    onboarded_at: new Date().toISOString(),
    timezone,
    ...preferencesToRow(answers.preferences),
  };
  if (typeof answers.displayName === "string" && answers.displayName.trim()) row.display_name = answers.displayName.trim().slice(0, 100);
  await updateProfile("completeOnboarding", row);
  console.log("[store] completeOnboarding — timezone:", timezone, "| school block:", answers.school ? "set" : "none");
  return userFromRow(await getProfileRow("completeOnboarding"));
}

/** Changes some onboarding answers without re-running setup (Settings, and
 *  clearing the starting intent once the student has used or dismissed it). */
export async function updatePreferences(patch: PreferencesPatch): Promise<UserProfile> {
  const row = preferencesToRow(patch);
  if (Object.keys(row).length) await updateProfile("updatePreferences", row);
  return userFromRow(await getProfileRow("updatePreferences"));
}

/** Leaves exactly one onboarding School series describing `hours`, or none
 *  when the student skipped school hours. Every earlier onboarding series is
 *  removed first, which is what makes repeated setup idempotent. Canvas
 *  items, one-off "school" tasks and anything else are never touched. */
export async function replaceSchoolBlock(hours: SchoolHours | null, timezone: string): Promise<void> {
  const { db, userId } = ctx();
  const recurring = await selectTasks("replaceSchoolBlock", (q) =>
    q.not("recurring_parent_id", "is", null).eq("kind", "school")
  );
  const today = getUserToday(timezone);
  const plan = planSchoolReplace(recurring, hours, today, addDaysYMD(today, SCHOOL_SERIES_WEEKS * 7));
  const stale = plan.deleteSeries;
  if (stale.length) {
    const { data, error } = await db
      .from("tasks")
      .delete()
      .eq("user_id", userId)
      .in("recurring_parent_id", stale)
      .select("id");
    if (error) fail("replaceSchoolBlock", error);
    console.log("[store] replaceSchoolBlock — removed series:", stale.length, "| rows:", data?.length ?? 0);
  }
  if (plan.add) await addRecurringTask(plan.add.task, plan.add.recurring);
}

/** "Restart onboarding": the first-run flow shows again on next load. */
export async function restartOnboarding(): Promise<void> {
  await updateProfile("restartOnboarding", { onboarded_at: null });
  console.log("[store] restartOnboarding");
}

// ─── Plan functions ───────────────────────────────────────────────────────────

// Tangent's palette, not stock Tailwind hues: iris, teal, lilac, mauve,
// deep teal-blue and their mid tones. Plans made before this carry an old
// colour in the database; planFromRow maps those onto this set.
const PLAN_COLORS = ["#4b3a8c", "#1f8f86", "#8a78e0", "#b06a9a", "#3d6f8a", "#6b5bc4", "#3aa89f"];

function brandColor(color: string, id: string): string {
  if (PLAN_COLORS.includes(color.toLowerCase())) return color;
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLAN_COLORS[h % PLAN_COLORS.length];
}

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
    color: brandColor(r.color ?? "", r.id),
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

/** Creates a plan and its tasks together: one duplicate-check read over the
 *  plan's date range, the plan row, ONE bulk insert of the tasks with plan_id
 *  already set, then the plan's task list. Replaces addTask ×N + addPlan +
 *  updateTask ×N. Tasks that duplicate an existing open task are skipped (the
 *  same rule as addTask) and reported, so undo never deletes a pre-existing task.
 *  The optional hooks report each row as soon as it exists, so a caller that
 *  rolls back (lib/pipeline/apply-core.ts) can undo them even if a later step
 *  in here fails. */
export async function addPlanWithTasks(
  plan: { title: string; description?: string },
  tasks: Omit<Task, "id" | "planId">[],
  hooks: { onPlanCreated?: (planId: string) => void; onTasksInserted?: (tasks: Task[]) => void } = {}
): Promise<{ plan: Plan; tasks: Task[]; skippedDuplicates: number }> {
  const { db, userId } = ctx();
  const dates = tasks.map((t) => t.date).sort();
  const existing = dates.length
    ? await selectTasks("addPlanWithTasks", (q) => q.gte("date", dates[0]).lte("date", dates[dates.length - 1]).eq("completed", false))
    : [];
  const fresh: Omit<Task, "id" | "planId">[] = [];
  let skippedDuplicates = 0;
  for (const t of tasks) {
    // Also dedupe within the plan itself.
    if (findDuplicateIn(existing, t) || findDuplicateIn(fresh as Task[], t)) skippedDuplicates++;
    else fresh.push(t);
  }

  const created = await addPlan({ title: plan.title, description: plan.description ?? "", taskIds: [], taskCount: 0 });
  hooks.onPlanCreated?.(created.id);
  const inserted: Task[] = [];
  for (let i = 0; i < fresh.length; i += 500) {
    const rows = fresh.slice(i, i + 500).map((t) => newTaskRow(userId, { ...t, planId: created.id }));
    const { data, error } = await db.from("tasks").insert(rows).select(TASK_COLUMNS);
    if (error) {
      // A failed insert writes nothing; don't leave an empty plan behind.
      await deletePlan(created.id).catch(() => {});
      fail("addPlanWithTasks", error);
    }
    const batch = (data as TaskRow[]).map(taskFromRow);
    inserted.push(...batch);
    hooks.onTasksInserted?.(batch);
  }
  const taskIds = inserted.map((t) => t.id);
  const { error: linkError } = await db
    .from("plans")
    .update({ task_ids: taskIds, task_count: taskIds.length })
    .eq("user_id", userId)
    .eq("id", created.id);
  if (linkError) fail("addPlanWithTasks", linkError);
  console.log("[store] addPlanWithTasks:", created.id, created.title, "tasks:", taskIds.length, "| duplicates skipped:", skippedDuplicates);
  return { plan: { ...created, taskIds, taskCount: taskIds.length }, tasks: inserted, skippedDuplicates };
}

/** Adds steps to an existing project: one bulk insert with plan_id set, the
 *  same duplicate rule as addPlanWithTasks, then the plan's task list. */
export async function addTasksToPlan(
  planId: string,
  tasks: Omit<Task, "id" | "planId">[]
): Promise<{ tasks: Task[]; skippedDuplicates: number }> {
  const { db, userId } = ctx();
  const { data: planRow, error: planError } = await db.from("plans").select("*").eq("user_id", userId).eq("id", planId).maybeSingle();
  if (planError) fail("addTasksToPlan", planError);
  if (!planRow) throw new Error("[store] addTasksToPlan: no such project");
  const dates = tasks.map((t) => t.date).sort();
  const existing = dates.length
    ? await selectTasks("addTasksToPlan", (q) => q.gte("date", dates[0]).lte("date", dates[dates.length - 1]).eq("completed", false))
    : [];
  const fresh: Omit<Task, "id" | "planId">[] = [];
  let skippedDuplicates = 0;
  for (const t of tasks) {
    if (findDuplicateIn(existing, t) || findDuplicateIn(fresh as Task[], t)) skippedDuplicates++;
    else fresh.push(t);
  }
  const inserted: Task[] = [];
  if (fresh.length > 0) {
    const { data, error } = await db.from("tasks").insert(fresh.map((t) => newTaskRow(userId, { ...t, planId }))).select(TASK_COLUMNS);
    if (error) fail("addTasksToPlan", error);
    inserted.push(...(data as TaskRow[]).map(taskFromRow));
  }
  const plan = planFromRow(planRow as PlanRow);
  const taskIds = [...plan.taskIds, ...inserted.map((t) => t.id)];
  const { error: linkError } = await db
    .from("plans")
    .update({ task_ids: taskIds, task_count: taskIds.length })
    .eq("user_id", userId)
    .eq("id", planId);
  if (linkError) fail("addTasksToPlan", linkError);
  return { tasks: inserted, skippedDuplicates };
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

/** Changes a plan's title, description or task list. A Project is a plan with
 *  a home page (app/(app)/projects), where its title and goal (the plan's
 *  description) are edited; Pipeline V2 (lib/pipeline/apply.ts) also uses it
 *  and to put a plan back on undo. A blank title is ignored. */
export async function updatePlan(
  planId: string,
  patch: { title?: string; description?: string; taskIds?: string[]; taskCount?: number }
): Promise<Plan | null> {
  if (!isUuid(planId)) return null;
  const row: Record<string, unknown> = {};
  if (patch.title != null && patch.title.trim()) row.title = patch.title.trim().slice(0, 120);
  if (patch.description != null) row.description = patch.description.trim().slice(0, 1000);
  if (patch.taskIds) row.task_ids = patch.taskIds.filter(isUuid);
  if (patch.taskCount != null) row.task_count = patch.taskCount;
  const { db, userId } = ctx();
  const query = db.from("plans");
  const { data, error } = await (Object.keys(row).length
    ? query.update(row).eq("user_id", userId).eq("id", planId).select("*").maybeSingle()
    : query.select("*").eq("user_id", userId).eq("id", planId).maybeSingle());
  if (error) fail("updatePlan", error);
  return data ? planFromRow(data as PlanRow) : null;
}

// ─── Task chat functions ──────────────────────────────────────────────────────

const MAX_MESSAGES = 200;
const MAX_CHATS = 50;

type MessageRow = {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  action_id?: string | null;
  change_set_id?: string | null;
};

function messageFromRow(r: MessageRow): ChatMessage {
  return {
    role: r.role,
    content: r.content,
    timestamp: iso(r.created_at),
    ...(r.action_id ? { actionId: r.action_id } : {}),
    ...(r.change_set_id ? { changeSetId: r.change_set_id } : {}),
  };
}

/** chat_messages.action_id / change_set_id come from migration 20261011000000;
 *  until it is applied, chats load and save without them (no Undo after reload). */
let warnedMessageRefsMissing = false;
function messageRefsMissing(error: { code?: string; message: string }): boolean {
  const missing = isMissingColumn(error) || error.code === "PGRST204" || /action_id|change_set_id/.test(error.message);
  if (missing && !warnedMessageRefsMissing) {
    console.warn("[store] chat_messages is missing action_id/change_set_id; apply migration 20261011000000");
    warnedMessageRefsMissing = true;
  }
  return missing;
}

/** Deletes the oldest rows of a message thread beyond the cap. */
async function trimThread(table: "chat_messages" | "task_chat_messages", column: "session_id" | "task_id", key: string) {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .eq(column, key)
    .order("id", { ascending: false })
    .range(MAX_MESSAGES, MAX_MESSAGES + PAGE - 1);
  if (error) fail(`trim ${table}`, error);
  const ids = (data ?? []).map((r: { id: number }) => r.id);
  if (ids.length === 0) return;
  const { error: delError } = await db.from(table).delete().eq("user_id", userId).in("id", ids);
  if (delError) fail(`trim ${table}`, delError);
}

export async function getTaskChat(taskId: string): Promise<ChatMessage[]> {
  if (!isUuid(taskId)) return [];
  const { db, userId } = ctx();
  const rows = await selectAll<MessageRow>("getTaskChat", (from, to) =>
    db
      .from("task_chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .order("id")
      .range(from, to)
  );
  return rows.map(messageFromRow);
}

export async function addTaskChatMessage(taskId: string, role: "user" | "assistant", content: string): Promise<ChatMessage> {
  if (!isUuid(taskId)) throw new Error("[store] addTaskChatMessage: task not found");
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("task_chat_messages")
    .insert({ user_id: userId, task_id: taskId, role, content })
    .select("id, role, content, created_at")
    .single();
  if (error) fail("addTaskChatMessage", error);
  await trimThread("task_chat_messages", "task_id", taskId);
  console.log("[store] addTaskChatMessage:", taskId, role, content.slice(0, 60));
  return messageFromRow(data as MessageRow);
}

// ─── Chat session functions ───────────────────────────────────────────────────

type SessionRow = {
  id: string;
  title: string;
  task_ids: string[];
  plan_id: string | null;
  color: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
};

const SESSION_COLUMNS = "id, title, task_ids, plan_id, color, pinned, created_at, updated_at";

function sessionFromRow(r: SessionRow, messages: ChatMessage[]): ChatSession {
  const s: ChatSession = {
    id: r.id,
    title: r.title,
    messages,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
    pinned: r.pinned,
  };
  if (r.task_ids?.length) s.taskIds = [...r.task_ids];
  if (r.plan_id) s.planId = r.plan_id;
  if (r.color) s.color = r.color;
  return s;
}

async function getSessionRow(sessionId: string): Promise<SessionRow | null> {
  if (!isUuid(sessionId)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("chat_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) fail("getChatSession", error);
  return (data as SessionRow | null) ?? null;
}

async function updateSessionRow(where: string, sessionId: string, row: Record<string, unknown>): Promise<SessionRow | null> {
  if (!isUuid(sessionId)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("chat_sessions")
    .update(row)
    .eq("user_id", userId)
    .eq("id", sessionId)
    .select(SESSION_COLUMNS)
    .maybeSingle();
  if (error) fail(where, error);
  return (data as SessionRow | null) ?? null;
}

async function sessionMessages(sessionIds: string[]): Promise<Map<string, ChatMessage[]>> {
  const bySession = new Map<string, ChatMessage[]>();
  if (sessionIds.length === 0) return bySession;
  const { db, userId } = ctx();
  type Row = MessageRow & { session_id: string };
  const read = (columns: string) =>
    selectAll<Row>("chat messages", (from, to) =>
      db
        .from("chat_messages")
        .select(columns)
        .eq("user_id", userId)
        .in("session_id", sessionIds)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
    );
  let rows: Row[];
  try {
    rows = await read("id, session_id, role, content, created_at, action_id, change_set_id");
  } catch (e) {
    if (!messageRefsMissing({ message: e instanceof Error ? e.message : String(e) })) throw e;
    rows = await read("id, session_id, role, content, created_at");
  }
  for (const r of rows) {
    const list = bySession.get(r.session_id) ?? [];
    list.push(messageFromRow(r));
    bySession.set(r.session_id, list);
  }
  return bySession;
}

/** Newest chat first, each with its messages (the chat list searches them). */
export async function getAllChatSessions(): Promise<ChatSession[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("chat_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(MAX_CHATS);
  if (error) fail("getAllChatSessions", error);
  const rows = (data ?? []) as SessionRow[];
  const messages = await sessionMessages(rows.map((r) => r.id));
  return rows.map((r) => sessionFromRow(r, messages.get(r.id) ?? []));
}

export async function createChatSession(title?: string): Promise<ChatSession> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("chat_sessions")
    .insert({
      user_id: userId,
      title: title ?? `Chat ${new Date().toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    })
    .select(SESSION_COLUMNS)
    .single();
  if (error) fail("createChatSession", error);
  const session = sessionFromRow(data as SessionRow, []);

  // Keep the newest MAX_CHATS chats; their messages cascade.
  const { data: old, error: oldError } = await db
    .from("chat_sessions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id")
    .range(MAX_CHATS, MAX_CHATS + PAGE - 1);
  if (oldError) fail("createChatSession", oldError);
  const oldIds = (old ?? []).map((r: { id: string }) => r.id);
  if (oldIds.length) {
    const { error: delError } = await db.from("chat_sessions").delete().eq("user_id", userId).in("id", oldIds);
    if (delError) fail("createChatSession", delError);
  }

  console.log("[store] createChatSession:", session.id, session.title);
  return session;
}

export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  const row = await getSessionRow(sessionId);
  if (!row) return null;
  const messages = await sessionMessages([row.id]);
  return sessionFromRow(row, messages.get(row.id) ?? []);
}

export async function addChatSessionMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  refs: ChatMessageRefs = {}
): Promise<ChatMessage | null> {
  const row = await updateSessionRow("addChatSessionMessage", sessionId, { updated_at: new Date().toISOString() });
  if (!row) return null;
  const { db, userId } = ctx();
  const base = { user_id: userId, session_id: sessionId, role, content };
  const withRefs = role === "assistant" && !!(refs.actionId || refs.changeSetId);
  let { data, error } = withRefs
    ? await db
        .from("chat_messages")
        .insert({ ...base, action_id: refs.actionId ?? null, change_set_id: refs.changeSetId ?? null })
        .select("id, role, content, created_at, action_id, change_set_id")
        .single()
    : await db.from("chat_messages").insert(base).select("id, role, content, created_at").single();
  if (error && withRefs && messageRefsMissing(error)) {
    ({ data, error } = await db.from("chat_messages").insert(base).select("id, role, content, created_at").single());
  }
  if (error) fail("addChatSessionMessage", error);
  await trimThread("chat_messages", "session_id", sessionId);
  return messageFromRow(data as MessageRow);
}

/** Pipeline V2 "Just talking": swaps the saved preview summary for the chat
 *  reply, so the turn keeps one assistant message. Only the session's newest
 *  message is changed, and only if it is that assistant text; returns false
 *  otherwise (nothing is written). */
export async function replaceLastAssistantMessage(sessionId: string, from: string, to: string): Promise<boolean> {
  const row = await getSessionRow(sessionId);
  if (!row) return false;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("chat_messages")
    .select("id, role, content")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("replaceLastAssistantMessage", error);
  const last = data as { id: string; role: string; content: string } | null;
  if (!last || last.role !== "assistant" || last.content !== from) return false;
  const { data: updated, error: updateError } = await db
    .from("chat_messages")
    .update({ content: to })
    .eq("user_id", userId)
    .eq("id", last.id)
    .eq("content", from)
    .select("id");
  if (updateError) fail("replaceLastAssistantMessage", updateError);
  return (updated?.length ?? 0) > 0;
}

/**
 * Attaches the change an earlier assistant message led to: the newest one in
 * this session previewing `changeSetId` (a card confirmed later), or else the
 * newest with exactly `content` (a plan drafted from the chat). Returns false
 * when there is no such message or the columns don't exist yet.
 */
export async function attachChatMessageRefs(
  sessionId: string,
  match: { changeSetId?: string; content?: string },
  refs: ChatMessageRefs
): Promise<boolean> {
  if (!refs.actionId && !refs.changeSetId) return false;
  if (!match.changeSetId && !match.content) return false;
  if (!(await getSessionRow(sessionId))) return false;
  const { db, userId } = ctx();
  let query = db.from("chat_messages").select("id").eq("user_id", userId).eq("session_id", sessionId).eq("role", "assistant");
  query = match.changeSetId ? query.eq("change_set_id", match.changeSetId) : query.eq("content", match.content as string);
  const { data, error } = await query.order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (messageRefsMissing(error)) return false;
    fail("attachChatMessageRefs", error);
  }
  const target = data as { id: number } | null;
  if (!target) return false;
  const patch: Record<string, string> = {};
  if (refs.actionId) patch.action_id = refs.actionId;
  if (refs.changeSetId) patch.change_set_id = refs.changeSetId;
  const { error: updateError } = await db.from("chat_messages").update(patch).eq("user_id", userId).eq("id", target.id);
  if (updateError) {
    if (messageRefsMissing(updateError)) return false;
    fail("attachChatMessageRefs", updateError);
  }
  return true;
}

export async function renameChatSession(sessionId: string, title: string): Promise<boolean> {
  if (!title.trim()) return !!(await getSessionRow(sessionId));
  return !!(await updateSessionRow("renameChatSession", sessionId, { title: title.trim(), updated_at: new Date().toISOString() }));
}

/** Sets a chat's user-chosen highlight color (null clears it) and/or pin state. */
export async function styleChatSession(
  sessionId: string,
  style: { color?: string | null; pinned?: boolean }
): Promise<ChatSession | null> {
  const row: Record<string, unknown> = {};
  if (style.color !== undefined) row.color = style.color;
  if (style.pinned !== undefined) row.pinned = style.pinned;
  if (Object.keys(row).length === 0) return getChatSession(sessionId);
  if (!(await updateSessionRow("styleChatSession", sessionId, row))) return null;
  return getChatSession(sessionId);
}

/** Links a chat to the tasks/plan an action touched (read from the action's
 *  undo snapshot), or to explicit ids. Links accumulate across the chat. */
export async function linkChatSession(
  sessionId: string,
  link: { actionId?: string; taskIds?: string[]; planId?: string | null }
): Promise<ChatSession | null> {
  const current = await getSessionRow(sessionId);
  if (!current) return null;
  const taskIds = new Set(current.task_ids ?? []);
  let planId = current.plan_id;

  if (link.actionId) {
    const snap = (await findActionRecord(link.actionId))?.snapshot;
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

  const row = await updateSessionRow("linkChatSession", sessionId, {
    task_ids: Array.from(taskIds).filter(isUuid),
    plan_id: isUuid(planId) ? planId : null,
  });
  if (!row) return null;
  return getChatSession(sessionId);
}

export async function deleteChatSession(sessionId: string): Promise<boolean> {
  if (!isUuid(sessionId)) return false;
  const { db, userId } = ctx();
  const { data, error } = await db.from("chat_sessions").delete().eq("user_id", userId).eq("id", sessionId).select("id");
  if (error) fail("deleteChatSession", error);
  if (!data?.length) return false;
  console.log("[store] deleteChatSession:", sessionId);
  return true;
}

// ─── Full state helpers ───────────────────────────────────────────────────────

export async function getAppState(): Promise<AppState> {
  const [tasks, calendars, plans, profile, capacity] = await Promise.all([
    getAllTasks(),
    getAllCalendars(),
    getAllPlans(),
    getProfileRow("getAppState"),
    getCapacity(),
  ]);
  await attachPathOrigins(tasks);
  return {
    tasks,
    calendars,
    events: [],
    user: { ...userFromRow(profile), schoolHours: schoolHoursFromTasks(tasks), capacity },
    weeklyPlan: [...(profile.weekly_plan ?? [])],
    lastVoiceCommand: profile.last_voice_command,
    lastVoiceResponse: profile.last_voice_response,
    plans,
  };
}

/** Adds "From your X path" display data to tasks linked to a Path node. One
 *  round trip, and none at all when no task is linked. */
async function attachPathOrigins(tasks: Task[]): Promise<void> {
  const nodeIds = Array.from(new Set(tasks.map((t) => t.pathNodeId).filter(isUuid)));
  if (nodeIds.length === 0) return;
  const { db, userId } = ctx();
  const [nodes, paths] = await Promise.all([
    db.from("path_nodes").select("id, title, path_id").eq("user_id", userId).in("id", nodeIds),
    db.from("paths").select("id, title").eq("user_id", userId),
  ]);
  if (nodes.error) fail("attachPathOrigins", nodes.error);
  if (paths.error) fail("attachPathOrigins", paths.error);
  const pathTitle = new Map(((paths.data ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const origins = new Map<string, NonNullable<Task["pathOrigin"]>>();
  for (const n of (nodes.data ?? []) as { id: string; title: string; path_id: string }[]) {
    const title = pathTitle.get(n.path_id);
    if (title) origins.set(n.id, { pathId: n.path_id, pathTitle: title, nodeTitle: n.title });
  }
  for (const t of tasks) {
    const origin = t.pathNodeId ? origins.get(t.pathNodeId) : undefined;
    if (origin) t.pathOrigin = origin;
  }
}

export async function getState(): Promise<AppState> {
  return getAppState();
}

/** Saves the profile parts of a client-sent state. Tasks, plans and calendars
 *  are only changed through their own endpoints, so a stale client can't
 *  overwrite them. Onboarding has its own endpoint (/api/onboarding). */
export async function replaceState(next: Partial<AppState>): Promise<void> {
  if (next.user) await updateUser({ displayName: next.user.displayName });
  if (Array.isArray(next.weeklyPlan)) await setWeeklyPlan(next.weeklyPlan);
}

// ─── User context functions ───────────────────────────────────────────────────

type ContextRow = {
  id: string;
  category: ContextEntry["category"];
  fact: string;
  source: ContextEntry["source"];
  created_at: string;
};

function contextFromRow(r: ContextRow): ContextEntry {
  return { id: r.id, timestamp: iso(r.created_at), category: r.category, fact: r.fact, source: r.source };
}

export async function getUserContext(): Promise<UserContext> {
  const { db, userId } = ctx();
  const [rows, profile] = await Promise.all([
    selectAll<ContextRow>("getUserContext", (from, to) =>
      db
        .from("context_entries")
        .select("id, category, fact, source, created_at")
        .eq("user_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to)
    ),
    getProfileRow("getUserContext"),
  ]);
  return {
    entries: rows.map(contextFromRow),
    compressedSummary: profile.context_summary ?? "",
    lastUpdated: iso(profile.context_updated_at),
    totalInteractions: profile.context_interactions ?? 0,
  };
}

export async function addContextEntry(entry: Omit<ContextEntry, "id" | "timestamp">): Promise<ContextEntry> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("context_entries")
    .insert({ user_id: userId, category: entry.category, fact: entry.fact, source: entry.source })
    .select("id, category, fact, source, created_at")
    .single();
  if (error) fail("addContextEntry", error);
  const profile = await getProfileRow("addContextEntry");
  await updateProfile("addContextEntry", {
    context_interactions: (profile.context_interactions ?? 0) + 1,
    context_updated_at: new Date().toISOString(),
  });
  const full = contextFromRow(data as ContextRow);
  console.log("[store] Context entry added:", full.category, full.fact.slice(0, 60));
  return full;
}

/** Removes one remembered fact (the student said it's wrong). */
export async function removeContextEntry(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { db, userId } = ctx();
  const { data, error } = await db.from("context_entries").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) fail("removeContextEntry", error);
  return (data?.length ?? 0) > 0;
}

export async function getContextAsString(): Promise<string> {
  const c = await getUserContext();
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
  await updateProfile("setCompressedSummary", { context_summary: summary, context_updated_at: new Date().toISOString() });
  // Keep only the newest 10 entries after compression.
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("context_entries")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(10, 10 + PAGE - 1);
  if (error) fail("setCompressedSummary", error);
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length) {
    const { error: delError } = await db.from("context_entries").delete().eq("user_id", userId).in("id", ids);
    if (delError) fail("setCompressedSummary", delError);
  }
  console.log("[store] Context compressed. Summary length:", summary.length);
}

// ─── Timezone ─────────────────────────────────────────────────────────────────

/** The student's IANA timezone (profiles.timezone), for "today" on the server. */
export async function getUserTimezone(): Promise<string> {
  return requestMemo("timezone", readTimezone);
}

async function readTimezone(): Promise<string> {
  const { db, userId } = ctx();
  const { data, error } = await db.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
  if (error) fail("getUserTimezone", error);
  return isValidTimezone(data?.timezone) ? data.timezone : DEFAULT_TIMEZONE;
}

// ─── Notification functions ───────────────────────────────────────────────────

const MAX_NOTIFICATIONS = 50;
const NOTIFICATION_COLUMNS = "id, type, title, body, action_label, action_data, read, dismissed, created_at";

type NotificationRow = {
  id: string;
  type: Notification["type"];
  title: string;
  body: string;
  action_label: string | null;
  action_data: Record<string, unknown> | null;
  read: boolean;
  dismissed: boolean;
  created_at: string;
};

function notificationFromRow(r: NotificationRow): Notification {
  const n: Notification = {
    id: r.id,
    timestamp: iso(r.created_at),
    type: r.type,
    title: r.title,
    body: r.body,
    read: r.read,
    dismissed: r.dismissed,
  };
  if (r.action_label) n.actionLabel = r.action_label;
  if (r.action_data) n.actionData = r.action_data;
  return n;
}

async function findLiveNotification(type: Notification["type"], taskId: string): Promise<Notification | null> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("user_id", userId)
    .eq("type", type)
    .eq("task_id", taskId)
    .eq("dismissed", false)
    .maybeSingle();
  if (error) fail("addNotification", error);
  return data ? notificationFromRow(data as NotificationRow) : null;
}

export async function getNotifications(): Promise<Notification[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("notifications")
    .select(NOTIFICATION_COLUMNS)
    .eq("user_id", userId)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(MAX_NOTIFICATIONS);
  if (error) fail("getNotifications", error);
  return ((data ?? []) as NotificationRow[]).map(notificationFromRow);
}

export async function addNotification(notif: Omit<Notification, "id" | "timestamp" | "read" | "dismissed">): Promise<Notification> {
  // Dedup by task + type: proactive checks run on every page load AND on a cron
  // schedule, so without this the same overdue/reschedule nudge for one task can
  // stack up every time either trigger fires while it's still unresolved. The
  // partial unique index notifications_live_dedup_idx makes this race-safe.
  const rawTaskId = notif.actionData?.taskId;
  const taskId = rawTaskId === undefined || rawTaskId === null || rawTaskId === "" ? null : String(rawTaskId);
  if (taskId) {
    const existing = await findLiveNotification(notif.type, taskId);
    if (existing) {
      console.log("[store] Notification deduped:", notif.type, taskId);
      return existing;
    }
  }

  // One per (task, type) per day — and one per type per day for alerts about
  // no single task — even after it was dismissed. The proactive check runs on
  // page loads, so without this a dismissed alert came back as a new row
  // (and a new popup) on the very next page.
  // Tangent's questions are exempt: each set is its own conversation.
  const { db, userId } = ctx();
  const isQuestions = (notif.actionData as { kind?: string } | undefined)?.kind === "questions";
  if (!isQuestions && notif.type !== "daily_brief") {
    let recent = db
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .eq("user_id", userId)
      .eq("type", notif.type)
      .gte("created_at", new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    recent = taskId ? recent.eq("task_id", taskId) : recent.is("task_id", null);
    const { data: same, error: sameError } = await recent;
    if (sameError) fail("addNotification", sameError);
    if (same && same.length > 0) {
      console.log("[store] Notification deduped (today):", notif.type, taskId ?? "(no task)");
      return notificationFromRow(same[0] as NotificationRow);
    }
  }


  const { data, error } = await db
    .from("notifications")
    .insert({
      user_id: userId,
      type: notif.type,
      title: notif.title,
      body: notif.body,
      action_label: notif.actionLabel ?? null,
      action_data: notif.actionData ?? null,
    })
    .select(NOTIFICATION_COLUMNS)
    .single();
  if (error) {
    // Lost a race with a concurrent check that inserted the same live notification.
    if (error.code === "23505" && taskId) {
      const existing = await findLiveNotification(notif.type, taskId);
      if (existing) {
        console.log("[store] Notification deduped (concurrent):", notif.type, taskId);
        return existing;
      }
    }
    fail("addNotification", error);
  }
  const full = notificationFromRow(data as NotificationRow);

  // Keep the newest MAX_NOTIFICATIONS (dismissed ones included).
  const { data: old, error: oldError } = await db
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id")
    .range(MAX_NOTIFICATIONS, MAX_NOTIFICATIONS + PAGE - 1);
  if (oldError) fail("addNotification", oldError);
  const oldIds = (old ?? []).map((r: { id: string }) => r.id);
  if (oldIds.length) {
    const { error: delError } = await db.from("notifications").delete().eq("user_id", userId).in("id", oldIds);
    if (delError) fail("addNotification", delError);
  }

  console.log("[store] Notification added:", full.type, full.title);
  return full;
}

async function updateNotification(where: string, id: string, row: Record<string, unknown>): Promise<void> {
  if (!isUuid(id)) return;
  const { db, userId } = ctx();
  const { error } = await db.from("notifications").update(row).eq("user_id", userId).eq("id", id);
  if (error) fail(where, error);
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateNotification("markNotificationRead", id, { read: true });
}

export async function dismissNotification(id: string): Promise<void> {
  await updateNotification("dismissNotification", id, { dismissed: true });
}

export async function dismissAllNotifications(): Promise<void> {
  const { db, userId } = ctx();
  const { error } = await db.from("notifications").update({ dismissed: true }).eq("user_id", userId).eq("dismissed", false);
  if (error) fail("dismissAllNotifications", error);
}

const MAX_POPUP_CLAIM = MAX_NOTIFICATIONS;
let warnedShownAtMissing = false;

/** Marks notifications as popped and returns the ids this call claimed —
 *  the ones that had never popped before (unread, live, own rows only). The
 *  single conditional UPDATE makes it race-safe across tabs and devices.
 *  Returns null when the shown_at migration hasn't been applied yet; the
 *  browser then falls back to its own per-user record. */
export async function claimNotificationPopups(ids: unknown[]): Promise<string[] | null> {
  const valid = Array.from(new Set(ids.filter(isUuid))).slice(0, MAX_POPUP_CLAIM);
  if (valid.length === 0) return [];
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("notifications")
    .update({ shown_at: new Date().toISOString() })
    .eq("user_id", userId)
    .in("id", valid)
    .is("shown_at", null)
    .eq("read", false)
    .eq("dismissed", false)
    .select("id");
  if (error) {
    if (error.code === "42703" || error.code === "PGRST204" || /shown_at/.test(error.message)) {
      if (!warnedShownAtMissing) console.warn("[store] claimNotificationPopups: notifications.shown_at missing — apply migration 20260927010000; browser fallback in use");
      warnedShownAtMissing = true;
      return null;
    }
    fail("claimNotificationPopups", error);
  }
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { db, userId } = ctx();
  const { count, error } = await db
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false)
    .eq("dismissed", false);
  if (error) fail("getUnreadNotificationCount", error);
  return count ?? 0;
}

// ─── Action Receipts + Undo ────────────────────────────────────────────────

const MAX_ACTIONS = 50;
const MAX_PENDING = 20;
const ACTION_COLUMNS = "id, kind, summary, undoable, undone, snapshot, created_at";

type ActionRow = {
  id: string;
  kind: ActionKind;
  summary: string;
  undoable: boolean;
  undone: boolean;
  snapshot: ActionSnapshot | null;
  created_at: string;
};

function actionFromRow(r: ActionRow): ActionRecord {
  return {
    id: r.id,
    kind: r.kind,
    summary: r.summary,
    createdAt: iso(r.created_at),
    undoable: r.undoable,
    undone: r.undone,
    snapshot: r.snapshot ?? {},
  };
}

/** Deletes a student's rows in `table` beyond the newest `keep`. */
async function trimNewest(table: "action_records" | "pending_confirmations", keep: number) {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(keep, keep + PAGE - 1);
  if (error) fail(`trim ${table}`, error);
  const ids = (data ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return;
  const { error: delError } = await db.from(table).delete().eq("user_id", userId).in("id", ids);
  if (delError) fail(`trim ${table}`, delError);
}

export async function recordAction(
  kind: ActionKind,
  summary: string,
  snapshot: ActionSnapshot,
  undoable = true
): Promise<ActionRecord> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("action_records")
    .insert({ user_id: userId, kind, summary, snapshot, undoable })
    .select(ACTION_COLUMNS)
    .single();
  if (error) fail("recordAction", error);
  await trimNewest("action_records", MAX_ACTIONS);
  const record = actionFromRow(data as ActionRow);
  console.log("[store] recordAction:", record.id, kind, "-", summary);
  return record;
}

/** Removes an undo entry whose changes were rolled back (Pipeline V2 apply),
 *  so no stray Undo survives. If the delete fails, marks it not undoable. */
export async function retireAction(id: string): Promise<void> {
  if (!isUuid(id)) return;
  const { db, userId } = ctx();
  const { error } = await db.from("action_records").delete().eq("user_id", userId).eq("id", id);
  if (!error) return;
  const { error: updateError } = await db.from("action_records").update({ undoable: false }).eq("user_id", userId).eq("id", id);
  if (updateError) fail("retireAction", updateError);
}

async function findActionRecord(id: string): Promise<ActionRecord | null> {
  if (!isUuid(id)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("action_records")
    .select(ACTION_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("findActionRecord", error);
  return data ? actionFromRow(data as ActionRow) : null;
}

/** The signed-in student's action records with these ids (others are simply
 *  absent). Used to re-check Undo when a saved chat is reopened. */
export async function getActionsByIds(ids: string[]): Promise<ActionRecord[]> {
  if (ids.length === 0) return [];
  const { db, userId } = ctx();
  const { data, error } = await db.from("action_records").select(ACTION_COLUMNS).eq("user_id", userId).in("id", ids.slice(0, MAX_ACTIONS));
  if (error) fail("getActionsByIds", error);
  return ((data ?? []) as ActionRow[]).map(actionFromRow);
}

export async function getRecentActions(limit = 20): Promise<ActionRecord[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("action_records")
    .select(ACTION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(Math.max(1, Math.min(limit, MAX_ACTIONS)));
  if (error) fail("getRecentActions", error);
  return ((data ?? []) as ActionRow[]).map(actionFromRow);
}

export async function undoAction(id: string): Promise<{ ok: boolean; message: string }> {
  const record = await findActionRecord(id);
  if (!record) return { ok: false, message: "That action could not be found." };
  if (record.undone) return { ok: false, message: "Already undone." };
  if (!record.undoable) return { ok: false, message: "This action can't be undone." };

  // Claim the undo atomically so a double click can't apply it twice.
  const { db, userId } = ctx();
  const { data: claimed, error } = await db
    .from("action_records")
    .update({ undone: true })
    .eq("user_id", userId)
    .eq("id", id)
    .eq("undone", false)
    .eq("undoable", true)
    .select("id");
  if (error) fail("undoAction", error);
  if (!claimed?.length) return { ok: false, message: "Already undone." };

  try {
    await applyUndo(record);
  } catch (e) {
    await db.from("action_records").update({ undone: false }).eq("user_id", userId).eq("id", id);
    throw e;
  }
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
    case "apply_changeset": {
      if (!snap.batch) break;
      await undoBatchSteps(snap.batch.steps);
      await markChangeSet(snap.batch.changeSetId, "undone", { from: "confirmed" });
      break;
    }
  }
}

/** Reverses a Pipeline V2 batch: the steps run last-first. Also used by
 *  lib/pipeline/apply.ts to roll back a ChangeSet that failed partway. */
export async function undoBatchSteps(steps: BatchUndoStep[]): Promise<void> {
  for (const step of [...steps].reverse()) {
    switch (step.type) {
      case "delete_tasks":
        await deleteTaskIds("undoBatchSteps", step.taskIds);
        break;
      case "delete_plan":
        await deletePlan(step.planId);
        break;
      case "restore_tasks":
        await restoreTasks(step.tasks);
        break;
      case "restore_task_fields":
        // null clears a column (taskPatchToRow maps null and undefined alike).
        await updateTask(step.taskId, step.fields as Partial<Omit<Task, "id">>);
        break;
      case "restore_plan":
        await updatePlan(step.planId, {
          title: step.title,
          description: step.description,
          taskIds: step.taskIds,
          taskCount: step.taskCount,
        });
        break;
    }
  }
}

// ─── Confirm-tier gating (delete_all_tasks, large move_tasks) ────────────────

type PendingRow = {
  id: string;
  kind: ActionKind;
  message: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const PENDING_COLUMNS = "id, kind, message, payload, created_at";

function pendingFromRow(r: PendingRow): PendingConfirmation {
  return { id: r.id, kind: r.kind, message: r.message, createdAt: iso(r.created_at), payload: r.payload ?? {} };
}

export async function addPendingConfirmation(
  kind: ActionKind,
  message: string,
  payload: Record<string, unknown>
): Promise<PendingConfirmation> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("pending_confirmations")
    .insert({ user_id: userId, kind, message, payload })
    .select(PENDING_COLUMNS)
    .single();
  if (error) fail("addPendingConfirmation", error);
  await trimNewest("pending_confirmations", MAX_PENDING);
  const pending = pendingFromRow(data as PendingRow);
  console.log("[store] addPendingConfirmation:", pending.id, kind, "-", message);
  return pending;
}

export async function getPendingConfirmation(id: string): Promise<PendingConfirmation | null> {
  if (!isUuid(id)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("pending_confirmations")
    .select(PENDING_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getPendingConfirmation", error);
  return data ? pendingFromRow(data as PendingRow) : null;
}

/** Confirmations still waiting on the student, newest first — lets a reloaded
 *  chat bring back its Confirm/Cancel buttons. */
export async function getOpenPendingConfirmations(): Promise<PendingConfirmation[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("pending_confirmations")
    .select(PENDING_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_PENDING);
  if (error) fail("getOpenPendingConfirmations", error);
  return ((data ?? []) as PendingRow[]).map(pendingFromRow);
}

/** Removes a pending confirmation. Returns true only for the caller that
 *  actually removed it, so a double-clicked confirm runs the action once. */
export async function resolvePendingConfirmation(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { db, userId } = ctx();
  const { data, error } = await db.from("pending_confirmations").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) fail("resolvePendingConfirmation", error);
  return (data?.length ?? 0) > 0;
}

// ─── Pipeline V2 change sets (lib/pipeline/changeset.ts) ─────────────────────

const CHANGE_SET_COLUMNS =
  "id, user_id, source, request_text, summary, intent, target_plan_id, ops, assumptions, status, created_at, confirmed_at, action_id, applied_at";

type ChangeSetRow = {
  id: string;
  user_id: string;
  source: ChangeSet["source"];
  request_text: string;
  summary: string;
  intent: ChangeSet["intent"];
  target_plan_id: string | null;
  ops: ChangeSet["ops"] | null;
  assumptions: string[] | null;
  status: ChangeSetStatus;
  created_at: string;
  confirmed_at: string | null;
  action_id: string | null;
  applied_at: string | null;
};

function changeSetFromRow(r: ChangeSetRow): ChangeSet {
  return {
    id: r.id,
    user_id: r.user_id,
    source: r.source,
    request_text: r.request_text,
    summary: r.summary,
    intent: r.intent,
    target_plan_id: r.target_plan_id,
    ops: r.ops ?? [],
    assumptions: r.assumptions ?? [],
    status: r.status,
    created_at: iso(r.created_at),
    confirmed_at: r.confirmed_at ? iso(r.confirmed_at) : null,
    action_id: r.action_id,
    applied_at: r.applied_at ? iso(r.applied_at) : null,
  };
}

/**
 * Saves a draft ChangeSet for the current student. The id is the idempotency
 * key: saving the same id again updates it only while it is still a draft
 * (an edited preview) and otherwise returns the stored one unchanged.
 * Throws if the ChangeSet is invalid, not a draft, or for another student.
 */
export async function saveChangeSet(input: ChangeSet): Promise<ChangeSet> {
  const parsed = parseChangeSet(input);
  if (!parsed.ok) throw new Error(`[store] saveChangeSet: invalid ChangeSet: ${parsed.error}`);
  const cs = parsed.changeSet;
  const { db, userId } = ctx();
  if (cs.user_id !== userId) throw new Error("[store] saveChangeSet: ChangeSet belongs to another student");
  if (cs.status !== "draft") throw new Error("[store] saveChangeSet: only drafts can be saved");

  const content = {
    source: cs.source,
    request_text: cs.request_text,
    summary: cs.summary,
    intent: cs.intent,
    target_plan_id: cs.target_plan_id,
    ops: cs.ops,
    assumptions: cs.assumptions,
  };
  const { data, error } = await db
    .from("change_sets")
    .insert({ id: cs.id, user_id: userId, status: "draft", created_at: cs.created_at, ...content })
    .select(CHANGE_SET_COLUMNS)
    .single();
  if (!error) return changeSetFromRow(data as ChangeSetRow);
  if ((error as DbError).code !== "23505") fail("saveChangeSet", error);

  // Already saved: update in place while it is still a draft.
  const { data: updated, error: updateError } = await db
    .from("change_sets")
    .update(content)
    .eq("user_id", userId)
    .eq("id", cs.id)
    .eq("status", "draft")
    .select(CHANGE_SET_COLUMNS)
    .maybeSingle();
  if (updateError) fail("saveChangeSet", updateError);
  if (updated) return changeSetFromRow(updated as ChangeSetRow);
  const existing = await getChangeSet(cs.id);
  if (!existing) throw new Error("[store] saveChangeSet: id is taken");
  return existing;
}

export async function getChangeSet(id: string): Promise<ChangeSet | null> {
  if (!isUuid(id)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("change_sets")
    .select(CHANGE_SET_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getChangeSet", error);
  return data ? changeSetFromRow(data as ChangeSetRow) : null;
}

/**
 * Moves a ChangeSet to `status`. With `from`, only a ChangeSet currently in
 * that status (or one of them) changes, so this doubles as an atomic claim:
 * of two racing confirms, only one gets true. Confirming stamps confirmed_at;
 * going back to draft clears it. `actionId` records the undo entry and
 * `applied` stamps applied_at (apply finished, with or without an undo entry).
 * The change_sets_guard trigger refuses any other status change.
 */
export async function markChangeSet(
  id: string,
  status: ChangeSetStatus,
  opts: { from?: ChangeSetStatus | ChangeSetStatus[]; actionId?: string | null; applied?: boolean } = {}
): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { db, userId } = ctx();
  const row: Record<string, unknown> = { status };
  if (status === "confirmed") row.confirmed_at = new Date().toISOString();
  if (status === "draft") {
    row.confirmed_at = null;
    row.action_id = null;
    row.applied_at = null;
  }
  if (opts.applied) row.applied_at = new Date().toISOString();
  if (opts.actionId !== undefined) row.action_id = isUuid(opts.actionId) ? opts.actionId : null;
  let q = db.from("change_sets").update(row).eq("user_id", userId).eq("id", id);
  if (opts.from !== undefined) {
    const from = Array.isArray(opts.from) ? opts.from : [opts.from];
    q = from.length === 1 ? q.eq("status", from[0]) : q.in("status", from);
  }
  const { data, error } = await q.select("id");
  if (error) fail("markChangeSet", error);
  const changed = (data?.length ?? 0) > 0;
  if (changed) console.log("[store] markChangeSet:", id, "→", status);
  return changed;
}

/** The student's drafts created at or after `sinceIso`, newest first (at most 20). */
export async function listDraftChangeSets(sinceIso: string): Promise<ChangeSet[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("change_sets")
    .select(CHANGE_SET_COLUMNS)
    .eq("user_id", userId)
    .eq("status", "draft")
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) fail("listDraftChangeSets", error);
  return ((data ?? []) as ChangeSetRow[]).map(changeSetFromRow);
}

/** Discards the student's drafts created before `beforeIso`. Returns the ones
 *  it changed, so each can be logged. */
export async function expireDraftChangeSets(beforeIso: string): Promise<Pick<ChangeSet, "id" | "intent" | "ops">[]> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("change_sets")
    .update({ status: "discarded" })
    .eq("user_id", userId)
    .eq("status", "draft")
    .lt("created_at", beforeIso)
    .select("id, intent, ops");
  if (error) fail("expireDraftChangeSets", error);
  return ((data ?? []) as { id: string; intent: ChangeSet["intent"]; ops: ChangeSet["ops"] | null }[]).map((r) => ({
    id: r.id,
    intent: r.intent,
    ops: r.ops ?? [],
  }));
}

// ─── Daily Brief config ───────────────────────────────────────────────────────

export async function getBriefConfig(): Promise<BriefConfig | null> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("brief_configs")
    .select("sources, cadence, delivery_time")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("getBriefConfig", error);
  if (!data) return null;
  return {
    sources: Array.isArray(data.sources) ? data.sources : [],
    cadence: data.cadence,
    deliveryTime: data.delivery_time,
  };
}

export async function saveBriefConfig(config: BriefConfig): Promise<BriefConfig> {
  const { db, userId } = ctx();
  const { error } = await db.from("brief_configs").upsert(
    {
      user_id: userId,
      sources: config.sources.map((src) => ({ ...src })),
      cadence: config.cadence,
      delivery_time: config.deliveryTime,
    },
    { onConflict: "user_id" }
  );
  if (error) fail("saveBriefConfig", error);
  console.log("[store] saveBriefConfig — sources:", config.sources.length, "| cadence:", config.cadence, "| time:", config.deliveryTime);
  return (await getBriefConfig())!;
}

// Tracks an in-flight Anthropic Message Batch submitted by the daily-brief cron job
// (see app/api/cron/daily-brief/route.ts) so the next cron tick knows to poll for the
// result instead of resubmitting. Stored on the student's brief_configs row.
export async function getPendingBriefBatch(): Promise<PendingBriefBatch | null> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("brief_configs")
    .select("pending_batch_id, pending_batch_submitted_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("getPendingBriefBatch", error);
  if (!data?.pending_batch_id) return null;
  return { batchId: data.pending_batch_id, submittedAt: iso(data.pending_batch_submitted_at ?? new Date().toISOString()) };
}

export async function setPendingBriefBatch(batch: PendingBriefBatch | null): Promise<void> {
  const { db, userId } = ctx();
  const { error } = batch
    ? await db
        .from("brief_configs")
        .upsert(
          { user_id: userId, pending_batch_id: batch.batchId, pending_batch_submitted_at: batch.submittedAt },
          { onConflict: "user_id" }
        )
    : await db
        .from("brief_configs")
        .update({ pending_batch_id: null, pending_batch_submitted_at: null })
        .eq("user_id", userId);
  if (error) fail("setPendingBriefBatch", error);
  console.log("[store] setPendingBriefBatch:", batch ? `${batch.batchId} (submitted ${batch.submittedAt})` : "cleared");
}

// ─── Canvas .ics feed connection ──────────────────────────────────────────────
// The feed URL contains a private token that grants read access to the
// student's Canvas calendar, so it stays on the server: the browser only ever
// gets getCanvasFeedStatus(), which masks it.

type CanvasFeedRow = { ics_url: string; connected_at: string; last_synced_at: string | null; last_sync_count: number };

function canvasFeedFromRow(r: CanvasFeedRow): CanvasFeedConfig {
  return {
    icsUrl: decryptFeedUrl(r.ics_url),
    connectedAt: iso(r.connected_at),
    lastSyncedAt: r.last_synced_at ? iso(r.last_synced_at) : null,
    lastSyncCount: r.last_sync_count,
  };
}

/** "school.instructure.com/…/user_••••.ics" — host only, never the token. */
export function maskCanvasFeedUrl(icsUrl: string): string {
  return maskFeedUrl(icsUrl);
}

/** Full feed config including the secret URL. Server-only callers. */
export async function getCanvasFeed(): Promise<CanvasFeedConfig | null> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("canvas_feeds")
    .select("ics_url, connected_at, last_synced_at, last_sync_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) fail("getCanvasFeed", error);
  return data ? canvasFeedFromRow(data as CanvasFeedRow) : null;
}

/** Safe to send to the browser. */
export async function getCanvasFeedStatus(): Promise<CanvasFeedStatus | null> {
  const feed = await getCanvasFeed();
  if (!feed) return null;
  return {
    maskedUrl: maskCanvasFeedUrl(feed.icsUrl),
    connectedAt: feed.connectedAt,
    lastSyncedAt: feed.lastSyncedAt,
    lastSyncCount: feed.lastSyncCount,
  };
}

export async function saveCanvasFeed(icsUrl: string): Promise<CanvasFeedConfig> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("canvas_feeds")
    .upsert(
      { user_id: userId, ics_url: encryptFeedUrl(icsUrl), connected_at: new Date().toISOString(), last_synced_at: null, last_sync_count: 0 },
      { onConflict: "user_id" }
    )
    .select("ics_url, connected_at, last_synced_at, last_sync_count")
    .single();
  if (error) fail("saveCanvasFeed", error);
  console.log("[store] saveCanvasFeed: connected");
  return canvasFeedFromRow(data as CanvasFeedRow);
}

export async function recordCanvasSync(count: number): Promise<CanvasFeedConfig | null> {
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("canvas_feeds")
    .update({ last_synced_at: new Date().toISOString(), last_sync_count: count })
    .eq("user_id", userId)
    .select("ics_url, connected_at, last_synced_at, last_sync_count")
    .maybeSingle();
  if (error) fail("recordCanvasSync", error);
  console.log("[store] recordCanvasSync — count:", count);
  return data ? canvasFeedFromRow(data as CanvasFeedRow) : null;
}

// ─── Reset ────────────────────────────────────────────────────────────────────

/** Deletes everything the current student has made and sends them back to
 *  onboarding. Keeps the account, name, email, timezone, the four default
 *  calendars and any registered pen. Only this student's rows are touched. */
export async function resetUserData(): Promise<void> {
  const { db, userId } = ctx();
  // Tasks first (task chats cascade), then everything that may point at them.
  const tables = [
    "tasks",
    "plans",
    "chat_sessions",
    "notifications",
    "action_records",
    "pending_confirmations",
    "voice_logs",
    "context_entries",
    "brief_configs",
    "canvas_feeds",
    "paths", // path_nodes cascade
  ];
  for (const table of tables) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) fail(`resetUserData ${table}`, error);
  }
  const { error: calError } = await db
    .from("calendars")
    .delete()
    .eq("user_id", userId)
    .not("id", "in", `(${DEFAULT_CALENDAR_ORDER.join(",")})`);
  if (calError) fail("resetUserData calendars", calError);
  forgetMemo("calendars");
  forgetMemo("timezone");
  await updateProfile("resetUserData", {
    onboarded_at: null,
    is_high_school: null,
    help_focus: null,
    slip_point: null,
    day_view: null,
    working_toward: null,
    starting_intent: null,
    weekly_plan: [],
    last_voice_command: null,
    last_voice_response: null,
    context_summary: "",
    context_interactions: 0,
    context_updated_at: new Date().toISOString(),
  });
  console.log("[store] resetUserData: done");
}

// ─── Paths ───────────────────────────────────────────────────────────────────
// Several goals, each with its own tree (paths + path_nodes). A node belongs
// to exactly one Path via pathId; lib/path-layout.ts lays out one Path at a
// time. The database cascades a deleted path or node to everything under it.

export type PathSpace = { paths: Path[]; nodes: PathNode[] };

type PathRow = {
  id: string;
  title: string;
  kind: Path["kind"];
  target: string;
  current: string;
  deadline: string | null;
  hours_per_week: number | null;
  constraints: string | null;
  standing: string | null;
  created_at: string;
  updated_at: string;
};

const PATH_COLUMNS =
  "id, title, kind, target, current, deadline, hours_per_week, constraints, standing, created_at, updated_at";

function pathFromRow(r: PathRow): Path {
  const p: Path = {
    id: r.id,
    title: r.title,
    kind: r.kind,
    target: r.target,
    current: r.current,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
  if (r.deadline !== null) p.deadline = r.deadline;
  if (r.hours_per_week !== null) p.hoursPerWeek = Number(r.hours_per_week);
  if (r.constraints !== null) p.constraints = r.constraints;
  if (r.standing !== null) p.standing = r.standing;
  return p;
}

function pathPatchToRow(patch: Partial<Omit<Path, "id" | "createdAt">>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const has = (k: keyof Path) => Object.prototype.hasOwnProperty.call(patch, k);
  if (has("title") && patch.title != null) row.title = patch.title;
  if (has("kind") && patch.kind != null) row.kind = patch.kind;
  if (has("target")) row.target = patch.target ?? "";
  if (has("current")) row.current = patch.current ?? "";
  if (has("deadline")) row.deadline = patch.deadline ?? null;
  if (has("hoursPerWeek")) row.hours_per_week = patch.hoursPerWeek ?? null;
  if (has("constraints")) row.constraints = patch.constraints ?? null;
  if (has("standing")) row.standing = patch.standing ?? null;
  return row;
}

type PathNodeRow = {
  id: string;
  path_id: string;
  parent_id: string | null;
  kind: PathNode["kind"];
  title: string;
  detail: string | null;
  rationale: string | null;
  effort: string | null;
  category: PathNode["category"] | null;
  hours_per_week: number | null;
  years: number | null;
  status: TangentStatus;
  origin: PathNode["origin"];
  created_at: string;
};

const PATH_NODE_COLUMNS =
  "id, path_id, parent_id, kind, title, detail, rationale, effort, category, hours_per_week, years, status, origin, created_at";

function pathNodeFromRow(r: PathNodeRow): PathNode {
  const n: PathNode = {
    id: r.id,
    pathId: r.path_id,
    parentId: r.parent_id,
    kind: r.kind,
    title: r.title,
    status: r.status,
    origin: r.origin,
    createdAt: iso(r.created_at),
  };
  if (r.detail !== null) n.detail = r.detail;
  if (r.rationale !== null) n.rationale = r.rationale;
  if (r.effort !== null) n.effort = r.effort;
  if (r.category) n.category = r.category;
  if (r.hours_per_week !== null) n.hoursPerWeek = Number(r.hours_per_week);
  if (r.years !== null) n.years = Number(r.years);
  return n;
}

function pathNodePatchToRow(patch: Partial<Omit<PathNode, "id" | "createdAt">>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const has = (k: keyof PathNode) => Object.prototype.hasOwnProperty.call(patch, k);
  if (has("pathId") && isUuid(patch.pathId)) row.path_id = patch.pathId;
  if (has("parentId")) row.parent_id = isUuid(patch.parentId) ? patch.parentId : null;
  if (has("kind") && patch.kind != null) row.kind = patch.kind;
  if (has("title") && patch.title != null) row.title = patch.title;
  if (has("detail")) row.detail = patch.detail ?? null;
  if (has("rationale")) row.rationale = patch.rationale ?? null;
  if (has("effort")) row.effort = patch.effort ?? null;
  if (has("category")) row.category = patch.category ?? null;
  if (has("hoursPerWeek")) row.hours_per_week = patch.hoursPerWeek ?? null;
  if (has("years")) row.years = patch.years ?? null;
  if (has("status") && patch.status != null) row.status = patch.status;
  if (has("origin") && patch.origin != null) row.origin = patch.origin;
  return row;
}

async function selectPathNodes(where: string, pathId?: string): Promise<PathNode[]> {
  const { db, userId } = ctx();
  const rows = await selectAll<PathNodeRow>(where, (from, to) => {
    let q = db.from("path_nodes").select(PATH_NODE_COLUMNS).eq("user_id", userId);
    if (pathId) q = q.eq("path_id", pathId);
    return q.order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, to);
  });
  return rows.map(pathNodeFromRow);
}

export async function getPathSpace(): Promise<PathSpace> {
  const { db, userId } = ctx();
  const [pathsRes, nodes] = await Promise.all([
    db.from("paths").select(PATH_COLUMNS).eq("user_id", userId).order("created_at", { ascending: true }),
    selectPathNodes("getPathSpace"),
  ]);
  if (pathsRes.error) fail("getPathSpace", pathsRes.error);
  return { paths: ((pathsRes.data ?? []) as PathRow[]).map(pathFromRow), nodes };
}

/** Just the student's Paths (their goals), without the node trees. For the
 *  AI's picture of the student (lib/ai/student-context.ts). */
export async function getPathGoals(): Promise<Path[]> {
  const { db, userId } = ctx();
  const { data, error } = await db.from("paths").select(PATH_COLUMNS).eq("user_id", userId).order("created_at", { ascending: true });
  if (error) fail("getPathGoals", error);
  return ((data ?? []) as PathRow[]).map(pathFromRow);
}

/** One Path and only its own nodes. What the deep view loads. */
export async function getPath(pathId: string): Promise<{ path: Path; nodes: PathNode[] } | null> {
  if (!isUuid(pathId)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db.from("paths").select(PATH_COLUMNS).eq("user_id", userId).eq("id", pathId).maybeSingle();
  if (error) fail("getPath", error);
  if (!data) return null;
  return { path: pathFromRow(data as PathRow), nodes: await selectPathNodes("getPath", pathId) };
}

export async function createPath(input: Omit<Path, "id" | "createdAt" | "updatedAt">): Promise<Path> {
  const { db, userId } = ctx();
  const row = { user_id: userId, target: "", current: "", ...pathPatchToRow(input) };
  const { data, error } = await db.from("paths").insert(row).select(PATH_COLUMNS).single();
  if (error) fail("createPath", error);
  return pathFromRow(data as PathRow);
}

export async function updatePath(id: string, patch: Partial<Omit<Path, "id" | "createdAt">>): Promise<Path | null> {
  if (!isUuid(id)) return null;
  const { db, userId } = ctx();
  const row = pathPatchToRow(patch);
  // Touch the row even for an empty patch, so updatedAt still moves.
  if (Object.keys(row).length === 0) row.updated_at = new Date().toISOString();
  const { data, error } = await db
    .from("paths")
    .update(row)
    .eq("user_id", userId)
    .eq("id", id)
    .select(PATH_COLUMNS)
    .maybeSingle();
  if (error) fail("updatePath", error);
  return data ? pathFromRow(data as PathRow) : null;
}

/** Removes a Path and every node in it. */
export async function removePath(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const { db, userId } = ctx();
  const { data, error } = await db.from("paths").delete().eq("user_id", userId).eq("id", id).select("id");
  if (error) fail("removePath", error);
  return (data ?? []).length > 0;
}

export async function getPathNode(id: string): Promise<PathNode | null> {
  if (!isUuid(id)) return null;
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("path_nodes")
    .select(PATH_NODE_COLUMNS)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getPathNode", error);
  return data ? pathNodeFromRow(data as PathNodeRow) : null;
}

/** The chain from a node up to the root of its Path. Gives Claude the context
 *  that a node four levels deep is still, ultimately, about one goal. */
export async function pathAncestry(id: string): Promise<PathNode[]> {
  const start = await getPathNode(id);
  if (!start) return [];
  const nodes = await selectPathNodes("pathAncestry", start.pathId);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: PathNode[] = [];
  let cursor: PathNode | undefined = byId.get(id) ?? start;
  let guard = 0;
  while (cursor && guard++ < 32) {
    chain.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return chain;
}

type NewPathNode = Omit<PathNode, "id" | "createdAt" | "status"> & { status?: TangentStatus };

function newPathNodeRow(userId: string, input: NewPathNode): Record<string, unknown> {
  return {
    user_id: userId,
    ...pathNodePatchToRow({
      ...input,
      status: input.status ?? (input.kind === "idea" ? "suggested" : "accepted"),
    }),
  };
}

export async function addPathNode(input: NewPathNode): Promise<PathNode> {
  const [node] = await addPathNodes([input]);
  return node;
}

export async function addPathNodes(items: NewPathNode[]): Promise<PathNode[]> {
  if (items.length === 0) return [];
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("path_nodes")
    .insert(items.map((item) => newPathNodeRow(userId, item)))
    .select(PATH_NODE_COLUMNS);
  if (error) fail("addPathNodes", error);
  // Inserted rows come back in insert order.
  return (data as PathNodeRow[]).map(pathNodeFromRow);
}

export async function updatePathNode(
  id: string,
  patch: Partial<Omit<PathNode, "id" | "createdAt">>
): Promise<PathNode | null> {
  if (!isUuid(id)) return null;
  const row = pathNodePatchToRow(patch);
  if (Object.keys(row).length === 0) return getPathNode(id);
  const { db, userId } = ctx();
  const { data, error } = await db
    .from("path_nodes")
    .update(row)
    .eq("user_id", userId)
    .eq("id", id)
    .select(PATH_NODE_COLUMNS)
    .maybeSingle();
  if (error) fail("updatePathNode", error);
  return data ? pathNodeFromRow(data as PathNodeRow) : null;
}

/** Removes a node and everything that grew from it. Returns how many went. */
export async function removePathNode(id: string): Promise<number> {
  const node = await getPathNode(id);
  if (!node) return 0;
  // The parent_id foreign key cascades; count the subtree first for the caller.
  const nodes = await selectPathNodes("removePathNode", node.pathId);
  const doomed = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of nodes) {
      if (n.parentId && doomed.has(n.parentId) && !doomed.has(n.id)) {
        doomed.add(n.id);
        grew = true;
      }
    }
  }
  const { db, userId } = ctx();
  const { error } = await db.from("path_nodes").delete().eq("user_id", userId).eq("id", id);
  if (error) fail("removePathNode", error);
  return doomed.size;
}

/** Clears a node's un-acted-on suggestions so regenerating doesn't pile up
 *  duplicates. Anything you kept is left alone. */
export async function clearSuggestions(parentId: string): Promise<void> {
  if (!isUuid(parentId)) return;
  const { db, userId } = ctx();
  const { error } = await db
    .from("path_nodes")
    .delete()
    .eq("user_id", userId)
    .eq("parent_id", parentId)
    .eq("status", "suggested");
  if (error) fail("clearSuggestions", error);
}
