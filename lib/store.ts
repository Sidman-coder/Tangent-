import type {
  Task,
  Plan,
  Category,
  RecurringConfig,
  CalendarDef,
  CalendarEvent,
  UserProfile,
  AppState,
  VoiceLogEntry,
  Command,
  ContextEntry,
  UserContext,
  Notification,
  ActionKind,
  ActionRecord,
  ActionSnapshot,
  PendingConfirmation,
  BriefConfig,
} from "./types";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Internal store shape ─────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; content: string; timestamp: string };

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

interface StoreData {
  tasks: Task[];
  calendars: CalendarDef[];
  events: CalendarEvent[];
  user: UserProfile;
  weeklyPlan: string[];
  voiceLogs: VoiceLogEntry[];
  lastVoiceCommand: string | null;
  lastVoiceResponse: string | null;
  plans: Plan[];
  categories: Category[];
  taskChats: Record<string, ChatMessage[]>;
  chatSessions: ChatSession[];
}

// ─── Global store — survives HMR, resets only on process restart ─────────────
const g = global as typeof global & {
  __tangentStore?: StoreData;
  __tangentUserContext?: UserContext;
  __tangentNotifications?: Notification[];
  __tangentActions?: ActionRecord[];
  __tangentPending?: PendingConfirmation[];
  __tangentBriefConfig?: BriefConfig | null;
};
if (!g.__tangentStore) {
  g.__tangentStore = {
    tasks: [],
    calendars: [
      { id: "cal_all", name: "All Calendars", category: "ALL", color: "#c4b5fd" },
      { id: "cal_personal", name: "Personal", category: "personal", color: "#a78bfa" },
      { id: "cal_work", name: "Work", category: "work", color: "#34d399" },
    ],
    events: [],
    user: {
      displayName: "Tangent User",
      email: "you@example.com",
    },
    weeklyPlan: [
      "Mon: Deep work block AM",
      "Wed: Mid-week review",
      "Fri: Week wrap + next week sketch",
    ],
    voiceLogs: [],
    lastVoiceCommand: null,
    lastVoiceResponse: null,
    plans: [],
    categories: [
      { id: "cat_work", name: "Work", color: "#34d399", icon: "💼" },
      { id: "cat_personal", name: "Personal", color: "#a78bfa", icon: "🏠" },
      { id: "cat_health", name: "Health", color: "#f472b6", icon: "💪" },
      { id: "cat_learning", name: "Learning", color: "#38bdf8", icon: "📚" },
    ],
    taskChats: {},
    chatSessions: [],
  };
  console.log("[store] Initialized fresh store (process start).");
} else {
  console.log("[store] HMR reload — reusing existing store. Tasks:", g.__tangentStore.tasks.length);
}
const store: StoreData = g.__tangentStore;

if (!g.__tangentUserContext) {
  g.__tangentUserContext = {
    entries: [],
    compressedSummary: "",
    lastUpdated: new Date().toISOString(),
    totalInteractions: 0,
  } as UserContext;
}

if (!g.__tangentNotifications) {
  g.__tangentNotifications = [] as Notification[];
}

if (!g.__tangentActions) {
  g.__tangentActions = [] as ActionRecord[];
}

if (!g.__tangentPending) {
  g.__tangentPending = [] as PendingConfirmation[];
}

if (g.__tangentBriefConfig === undefined) {
  g.__tangentBriefConfig = null;
}

// ─── Task functions ───────────────────────────────────────────────────────────

export function getAllTasks(): Task[] {
  return store.tasks.map((t) => ({ ...t }));
}

export function getTasksByDate(date: string): Task[] {
  return store.tasks.filter((t) => t.date === date).map((t) => ({ ...t }));
}

export function getTasksByWeek(refDate?: string): Task[] {
  const ref = refDate ? new Date(refDate + "T12:00:00") : new Date();
  const day = ref.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return store.tasks
    .filter((t) => {
      const d = new Date(t.date + "T12:00:00");
      return d >= monday && d <= sunday;
    })
    .map((t) => ({ ...t }));
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

/** Finds a non-completed task on the same date, within 30 minutes, whose title
 *  overlaps ≥80% (lowercased token Jaccard) with the given task — used by
 *  addTask to silently skip inserting near-identical duplicates. */
function findDuplicateTask(task: Omit<Task, "id">): Task | undefined {
  return store.tasks.find(
    (t) =>
      !t.completed &&
      t.date === task.date &&
      timeDiffMinutes(t.time, task.time) <= 30 &&
      titleTokenOverlap(t.title, task.title) >= 0.8
  );
}

export function addTask(task: Omit<Task, "id">): Task & { wasDuplicate?: boolean } {
  const duplicate = findDuplicateTask(task);
  if (duplicate) {
    console.log("[store] addTask: skipped duplicate of", duplicate.id, duplicate.title);
    return { ...duplicate, wasDuplicate: true };
  }
  const newTask: Task = { id: uid("t"), ...task };
  store.tasks.push(newTask);
  console.log("[store] addTask:", newTask.id, newTask.title, newTask.date, newTask.time, newTask.kind);
  return { ...newTask };
}

export function completeTask(id: string): Task | null {
  const task = store.tasks.find((t) => t.id === id);
  if (!task) {
    console.log("[store] completeTask: not found", id);
    return null;
  }
  task.completed = true;
  console.log("[store] completeTask:", id, task.title);
  return { ...task };
}

export function deleteTask(id: string): boolean {
  const idx = store.tasks.findIndex((t) => t.id === id);
  if (idx === -1) {
    console.log("[store] deleteTask: not found", id);
    return false;
  }
  const [removed] = store.tasks.splice(idx, 1);
  console.log("[store] deleteTask:", id, removed.title);
  return true;
}

export function clearAllTasks(): void {
  const count = store.tasks.length;
  store.tasks = [];
  console.log("[store] clearAllTasks — removed", count, "tasks");
}

export function toggleTask(id: string): Task | null {
  const task = store.tasks.find((t) => t.id === id);
  if (!task) {
    console.log("[store] toggleTask: not found", id);
    return null;
  }
  task.completed = !task.completed;
  console.log("[store] toggleTask:", id, task.title, "->", task.completed);
  return { ...task };
}

export function updateTask(id: string, patch: Partial<Omit<Task, "id">>): Task | null {
  const task = store.tasks.find((t) => t.id === id);
  if (!task) {
    console.log("[store] updateTask: not found", id);
    return null;
  }
  Object.assign(task, patch);
  console.log("[store] updateTask:", id, patch);
  return { ...task };
}

// ─── Recurring task functions ─────────────────────────────────────────────────

export function addRecurringTask(
  task: Omit<Task, "id">,
  recurring: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    daysOfWeek?: number[];
    endDate?: string;
    occurrences?: number;
  }
): Task[] {
  const parentId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tasks: Task[] = [];
  const startDate = new Date(task.date + "T12:00:00");
  const endDate = recurring.endDate
    ? new Date(recurring.endDate + "T12:00:00")
    : new Date(startDate.getFullYear(), 11, 31, 12, 0, 0);

  let currentDate = new Date(startDate);
  let count = 0;
  const maxOccurrences = recurring.occurrences ?? 365;

  console.log("[store] addRecurringTask start — parentId:", parentId, "| freq:", recurring.frequency, "| from:", task.date, "| to:", endDate.toISOString().slice(0, 10));

  while (currentDate <= endDate && count < maxOccurrences) {
    let shouldAdd = false;

    if (recurring.frequency === "daily") {
      shouldAdd = true;
    } else if (recurring.frequency === "weekly") {
      if (recurring.daysOfWeek && recurring.daysOfWeek.includes(currentDate.getDay())) {
        shouldAdd = true;
      }
    } else if (recurring.frequency === "monthly") {
      if (currentDate.getDate() === startDate.getDate()) {
        shouldAdd = true;
      }
    } else if (recurring.frequency === "yearly") {
      if (
        currentDate.getMonth() === startDate.getMonth() &&
        currentDate.getDate() === startDate.getDate()
      ) {
        shouldAdd = true;
      }
    }

    if (shouldAdd) {
      const rec: RecurringConfig = {
        enabled: true,
        frequency: recurring.frequency,
        daysOfWeek: recurring.daysOfWeek,
        endDate: recurring.endDate,
        parentId,
      };
      const newTask = addTask({
        ...task,
        date: currentDate.toISOString().slice(0, 10),
        recurring: rec,
      });
      tasks.push(newTask);
      count++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log("[store] addRecurringTask done — created:", tasks.length, "instances for parentId:", parentId);
  return tasks;
}

export function deleteRecurringTask(taskId: string, deleteAll: boolean): number {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) {
    console.log("[store] deleteRecurringTask: task not found", taskId);
    return 0;
  }

  if (deleteAll && task.recurring?.parentId) {
    const parentId = task.recurring.parentId;
    const before = store.tasks.length;
    store.tasks = store.tasks.filter((t) => t.recurring?.parentId !== parentId);
    const removed = before - store.tasks.length;
    console.log("[store] deleteRecurringTask all — parentId:", parentId, "| removed:", removed);
    return removed;
  }

  // Delete only this instance
  const idx = store.tasks.findIndex((t) => t.id === taskId);
  if (idx !== -1) {
    store.tasks.splice(idx, 1);
    console.log("[store] deleteRecurringTask single — id:", taskId);
    return 1;
  }
  return 0;
}

export function updateRecurringTask(
  taskId: string,
  patch: Partial<Omit<Task, "id" | "recurring">>,
  updateAll: boolean
): number {
  const task = store.tasks.find((t) => t.id === taskId);
  if (!task) {
    console.log("[store] updateRecurringTask: task not found", taskId);
    return 0;
  }

  if (updateAll && task.recurring?.parentId) {
    const parentId = task.recurring.parentId;
    let updated = 0;
    for (const t of store.tasks) {
      if (t.recurring?.parentId === parentId) {
        Object.assign(t, patch);
        updated++;
      }
    }
    console.log("[store] updateRecurringTask all — parentId:", parentId, "| updated:", updated);
    return updated;
  }

  Object.assign(task, patch);
  console.log("[store] updateRecurringTask single — id:", taskId, patch);
  return 1;
}

export function getRecurringTasks(): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  for (const t of store.tasks) {
    if (t.recurring?.enabled && t.recurring.parentId) {
      const pid = t.recurring.parentId;
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push({ ...t });
    }
  }
  return groups;
}

// ─── Voice log functions ──────────────────────────────────────────────────────

export function getAllVoiceLogs(): VoiceLogEntry[] {
  return [...store.voiceLogs];
}

export function addVoiceLog(entry: Omit<VoiceLogEntry, "at">): void {
  const log: VoiceLogEntry = { at: new Date().toISOString(), ...entry };
  store.voiceLogs.unshift(log);
  if (store.voiceLogs.length > 100) store.voiceLogs.length = 100;
  store.lastVoiceCommand = entry.text;
  store.lastVoiceResponse = entry.response;
  console.log("[store] addVoiceLog action:", entry.action, "| ok:", entry.ok, "| text:", entry.text);
}

// ─── Calendar functions ───────────────────────────────────────────────────────

export function getAllCalendars(): CalendarDef[] {
  return store.calendars.map((c) => ({ ...c }));
}

/** Alias of getAllCalendars — used by calendar-intelligence code (voice-handler, voice-agent-tools). */
export function getCalendars(): CalendarDef[] {
  return getAllCalendars();
}

export function addCalendar(name: string, color?: string): CalendarDef {
  const cal: CalendarDef = {
    id: uid("cal"),
    name,
    category: name.toLowerCase().replace(/\s+/g, "_"),
    color: color ?? "#a78bfa",
  };
  store.calendars.push(cal);
  console.log("[store] addCalendar:", cal.id, cal.name);
  return { ...cal };
}

export function getTasksByCalendar(calendarId: string): Task[] {
  return store.tasks
    .filter((t) => (t.calendarId ?? "cal_all") === calendarId)
    .map((t) => ({ ...t }));
}

/** Moves all tasks matching the given filter to a different calendar. Returns the count moved. */
export function moveTasksToCalendar(
  filter: { title?: string; calendarId?: string; dateRange?: { start: string; end: string } },
  targetCalendarId: string
): number {
  const hasFilter = !!(filter.title || filter.calendarId || filter.dateRange);
  let moved = 0;
  for (const t of store.tasks) {
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

    if (!matches) continue;
    t.calendarId = targetCalendarId;
    moved++;
  }
  console.log("[store] moveTasksToCalendar:", JSON.stringify(filter), "->", targetCalendarId, "| moved:", moved);
  return moved;
}

/** Dry-run version of moveTasksToCalendar's matching logic — used to preview
 *  affected tasks (for confirm-tier gating and undo snapshots) before mutating. */
export function getTasksMatchingFilter(
  filter: { title?: string; calendarId?: string; dateRange?: { start: string; end: string } }
): Task[] {
  const hasFilter = !!(filter.title || filter.calendarId || filter.dateRange);
  return store.tasks
    .filter((t) => {
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
    })
    .map((t) => ({ ...t }));
}

// ─── Event functions ──────────────────────────────────────────────────────────

export function addEvent(event: Omit<CalendarEvent, "id">): CalendarEvent {
  const ev: CalendarEvent = { id: uid("ev"), ...event };
  store.events.push(ev);
  console.log("[store] addEvent:", ev.id, ev.title, ev.date);
  return { ...ev };
}

// ─── User / plan functions ────────────────────────────────────────────────────

export function updateUser(patch: Partial<UserProfile>): void {
  if (patch.displayName !== undefined) store.user.displayName = patch.displayName;
  if (patch.email !== undefined) store.user.email = patch.email;
}

export function setWeeklyPlan(items: string[]): void {
  store.weeklyPlan = [...items];
}

// ─── Plan functions ───────────────────────────────────────────────────────────

const PLAN_COLORS = ["#38bdf8", "#f472b6", "#fb923c", "#818cf8", "#e879f9", "#06b6d4", "#84cc16"];

export function getAllPlans(): Plan[] {
  return store.plans.map((p) => ({ ...p, taskIds: [...p.taskIds] }));
}

export function addPlan(plan: Omit<Plan, "id" | "createdAt" | "color">): Plan {
  const color = PLAN_COLORS[store.plans.length % PLAN_COLORS.length];
  const newPlan: Plan = {
    id: uid("plan"),
    ...plan,
    color,
    createdAt: new Date().toISOString(),
  };
  store.plans.push(newPlan);
  console.log("[store] addPlan:", newPlan.id, newPlan.title, "tasks:", newPlan.taskIds.length);
  return { ...newPlan, taskIds: [...newPlan.taskIds] };
}

export function deletePlan(planId: string): boolean {
  const idx = store.plans.findIndex((p) => p.id === planId);
  if (idx === -1) return false;
  store.plans.splice(idx, 1);
  console.log("[store] deletePlan:", planId);
  return true;
}

// ─── Category functions ───────────────────────────────────────────────────────

export function getAllCategories(): Category[] {
  return store.categories.map((c) => ({ ...c }));
}

export function addCategory(name: string, color?: string, icon?: string): Category {
  const cat: Category = {
    id: uid("cat"),
    name,
    color: color ?? "#a78bfa",
    icon,
  };
  store.categories.push(cat);
  console.log("[store] addCategory:", cat.id, cat.name);
  return { ...cat };
}

export function deleteCategory(categoryId: string): boolean {
  const idx = store.categories.findIndex((c) => c.id === categoryId);
  if (idx === -1) return false;
  store.categories.splice(idx, 1);
  // Clear categoryId from tasks in that category
  for (const t of store.tasks) {
    if (t.categoryId === categoryId) t.categoryId = null;
  }
  console.log("[store] deleteCategory:", categoryId);
  return true;
}

export function deleteTasksByCategory(categoryId: string): number {
  const before = store.tasks.length;
  store.tasks = store.tasks.filter((t) => t.categoryId !== categoryId);
  const removed = before - store.tasks.length;
  console.log("[store] deleteTasksByCategory:", categoryId, "| removed:", removed);
  return removed;
}

// ─── Task chat functions ──────────────────────────────────────────────────────

export function getTaskChat(taskId: string): ChatMessage[] {
  return (store.taskChats[taskId] ?? []).map((m) => ({ ...m }));
}

export function addTaskChatMessage(taskId: string, role: "user" | "assistant", content: string): ChatMessage {
  if (!store.taskChats[taskId]) store.taskChats[taskId] = [];
  const msg: ChatMessage = { role, content, timestamp: new Date().toISOString() };
  store.taskChats[taskId].push(msg);
  if (store.taskChats[taskId].length > 200) store.taskChats[taskId].splice(0, 1);
  console.log("[store] addTaskChatMessage:", taskId, role, content.slice(0, 60));
  return { ...msg };
}

// ─── Chat session functions ───────────────────────────────────────────────────

export function getAllChatSessions(): ChatSession[] {
  return store.chatSessions.map((s) => ({ ...s, messages: s.messages.map((m) => ({ ...m })) }));
}

export function createChatSession(title?: string): ChatSession {
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

export function getChatSession(sessionId: string): ChatSession | null {
  const s = store.chatSessions.find((s) => s.id === sessionId);
  if (!s) return null;
  return { ...s, messages: s.messages.map((m) => ({ ...m })) };
}

export function addChatSessionMessage(sessionId: string, role: "user" | "assistant", content: string): ChatMessage | null {
  const session = store.chatSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const msg: ChatMessage = { role, content, timestamp: new Date().toISOString() };
  session.messages.push(msg);
  session.updatedAt = new Date().toISOString();
  if (session.messages.length > 200) session.messages.splice(0, 1);
  return { ...msg };
}

export function renameChatSession(sessionId: string, title: string): boolean {
  const session = store.chatSessions.find((s) => s.id === sessionId);
  if (!session) return false;
  session.title = title.trim() || session.title;
  session.updatedAt = new Date().toISOString();
  return true;
}

export function deleteChatSession(sessionId: string): boolean {
  const idx = store.chatSessions.findIndex((s) => s.id === sessionId);
  if (idx === -1) return false;
  store.chatSessions.splice(idx, 1);
  console.log("[store] deleteChatSession:", sessionId);
  return true;
}

// ─── Full state helpers ───────────────────────────────────────────────────────

export function getAppState(): AppState {
  return {
    tasks: getAllTasks(),
    calendars: getAllCalendars(),
    events: store.events.map((e) => ({ ...e })),
    user: { ...store.user },
    weeklyPlan: [...store.weeklyPlan],
    lastVoiceCommand: store.lastVoiceCommand,
    lastVoiceResponse: store.lastVoiceResponse,
    plans: getAllPlans(),
    categories: getAllCategories(),
  };
}

export function getState(): AppState {
  return getAppState();
}

export function replaceState(next: AppState): void {
  if (Array.isArray(next.tasks)) store.tasks = next.tasks.map((t) => ({ ...t }));
  if (Array.isArray(next.calendars)) store.calendars = next.calendars.map((c) => ({ ...c }));
  if (Array.isArray(next.events)) store.events = next.events.map((e) => ({ ...e }));
  if (next.user) store.user = { ...next.user };
  if (Array.isArray(next.weeklyPlan)) store.weeklyPlan = [...next.weeklyPlan];
  if (Array.isArray(next.plans)) store.plans = next.plans.map((p) => ({ ...p, taskIds: [...p.taskIds] }));
}

// ─── Legacy applyCommands (used by /api/commands for calendar operations) ─────

function findTaskByTitle(title: string): Task | undefined {
  const n = title.trim().toLowerCase();
  if (!n) return undefined;
  return (
    store.tasks.find((t) => t.title.toLowerCase() === n) ??
    store.tasks.find((t) => t.title.toLowerCase().includes(n) || n.includes(t.title.toLowerCase()))
  );
}

export function applyCommands(commands: Command[]): AppState {
  for (const cmd of commands) {
    switch (cmd.type) {
      case "ADD_TASK": {
        const date = cmd.date ?? todayDate();
        addTask({
          title: cmd.title,
          date,
          time: cmd.time ?? "09:00",
          kind: cmd.kind,
          completed: false,
          calendarId: cmd.calendarId ?? null,
        });
        break;
      }
      case "UPDATE_TASK": {
        updateTask(cmd.id, {
          ...(cmd.title !== undefined && { title: cmd.title }),
          ...(cmd.date !== undefined && { date: cmd.date }),
          ...(cmd.time !== undefined && { time: cmd.time }),
          ...(cmd.kind !== undefined && { kind: cmd.kind }),
        });
        break;
      }
      case "REMOVE_TASK": {
        deleteTask(cmd.id);
        break;
      }
      case "ADD_CALENDAR": {
        addCalendar(cmd.name, cmd.color);
        break;
      }
      case "ADD_EVENT": {
        addEvent({
          calendarId: cmd.calendarId,
          title: cmd.title,
          date: cmd.date,
          time: cmd.time,
        });
        break;
      }
      case "UPDATE_USER": {
        updateUser({
          ...(cmd.displayName !== undefined && { displayName: cmd.displayName }),
          ...(cmd.email !== undefined && { email: cmd.email }),
        });
        break;
      }
      case "SET_WEEKLY_PLAN": {
        setWeeklyPlan(cmd.items);
        break;
      }
      default:
        break;
    }
  }
  return getAppState();
}

// ─── User context functions ───────────────────────────────────────────────────

export function getUserContext(): UserContext {
  return g.__tangentUserContext!;
}

export function addContextEntry(entry: Omit<ContextEntry, "id" | "timestamp">): ContextEntry {
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

export function getContextAsString(): string {
  const ctx = g.__tangentUserContext!;
  const entries = ctx.entries
    .slice(-50) // last 50 entries max
    .map((e) => `[${e.category}] ${e.fact}`)
    .join("\n");

  if (ctx.compressedSummary) {
    return `COMPRESSED HISTORY:\n${ctx.compressedSummary}\n\nRECENT:\n${entries}`;
  }
  return entries || "No user context yet.";
}

export function setCompressedSummary(summary: string): void {
  g.__tangentUserContext!.compressedSummary = summary;
  // Keep only last 10 entries after compression
  g.__tangentUserContext!.entries = g.__tangentUserContext!.entries.slice(-10);
  console.log("[store] Context compressed. Summary length:", summary.length);
}

// ─── Notification functions ───────────────────────────────────────────────────

export function getNotifications(): Notification[] {
  return g.__tangentNotifications!
    .filter((n) => !n.dismissed)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function addNotification(notif: Omit<Notification, "id" | "timestamp" | "read" | "dismissed">): Notification {
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

export function markNotificationRead(id: string): void {
  const n = g.__tangentNotifications!.find((n) => n.id === id);
  if (n) n.read = true;
}

export function dismissNotification(id: string): void {
  const n = g.__tangentNotifications!.find((n) => n.id === id);
  if (n) n.dismissed = true;
}

export function getUnreadNotificationCount(): number {
  return g.__tangentNotifications!.filter((n) => !n.read && !n.dismissed).length;
}

// ─── Action Receipts + Undo ────────────────────────────────────────────────

export function recordAction(
  kind: ActionKind,
  summary: string,
  snapshot: ActionSnapshot,
  undoable = true
): ActionRecord {
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

export function getRecentActions(limit = 20): ActionRecord[] {
  return g.__tangentActions!.slice(0, limit).map((a) => ({ ...a, snapshot: { ...a.snapshot } }));
}

export function undoAction(id: string): { ok: boolean; message: string } {
  const record = g.__tangentActions!.find((a) => a.id === id);
  if (!record) return { ok: false, message: "That action could not be found." };
  if (record.undone) return { ok: false, message: "Already undone." };
  if (!record.undoable) return { ok: false, message: "This action can't be undone." };

  switch (record.kind) {
    case "add_task":
    case "create_plan":
    case "add_recurring_task": {
      for (const taskId of record.snapshot.addedTaskIds ?? []) deleteTask(taskId);
      if (record.snapshot.addedPlanId) deletePlan(record.snapshot.addedPlanId);
      break;
    }
    case "delete_task":
    case "delete_all_tasks": {
      for (const t of record.snapshot.removedTasks ?? []) store.tasks.push({ ...t });
      break;
    }
    case "complete_task": {
      const taskId = record.snapshot.completedTaskId;
      const task = taskId ? store.tasks.find((t) => t.id === taskId) : undefined;
      if (task) task.completed = false;
      break;
    }
    case "move_tasks": {
      for (const move of record.snapshot.moves ?? []) {
        const task = store.tasks.find((t) => t.id === move.taskId);
        if (task) task.calendarId = move.fromCalendarId;
      }
      break;
    }
    case "reschedule_task": {
      const r = record.snapshot.rescheduled;
      const task = r ? store.tasks.find((t) => t.id === r.taskId) : undefined;
      if (task && r) {
        task.date = r.fromDate;
        task.time = r.fromTime;
      }
      break;
    }
  }

  record.undone = true;
  console.log("[store] undoAction:", id, record.kind);
  return { ok: true, message: "Undone." };
}

// ─── Confirm-tier gating (delete_all_tasks, large move_tasks) ────────────────

export function addPendingConfirmation(
  kind: ActionKind,
  message: string,
  payload: Record<string, unknown>
): PendingConfirmation {
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

export function getPendingConfirmation(id: string): PendingConfirmation | null {
  return g.__tangentPending!.find((p) => p.id === id) ?? null;
}

export function resolvePendingConfirmation(id: string): void {
  g.__tangentPending = g.__tangentPending!.filter((p) => p.id !== id);
}

// ─── Daily Brief config ───────────────────────────────────────────────────────

export function getBriefConfig(): BriefConfig | null {
  const cfg = g.__tangentBriefConfig;
  return cfg ? { ...cfg, sources: cfg.sources.map((s) => ({ ...s })) } : null;
}

export function saveBriefConfig(config: BriefConfig): BriefConfig {
  g.__tangentBriefConfig = { ...config, sources: config.sources.map((s) => ({ ...s })) };
  console.log("[store] saveBriefConfig — sources:", config.sources.length, "| cadence:", config.cadence, "| time:", config.deliveryTime);
  return getBriefConfig()!;
}
