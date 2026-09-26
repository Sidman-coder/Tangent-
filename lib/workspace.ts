// Per-workspace state, loaded and saved around a single request.
//
// The whole app used to read and write one object hanging off Node's `global`.
// On Vercel that meant two things, both bugs:
//
//   1. Each serverless instance held its own copy, so the same request could
//      answer with your tasks or with an empty workspace depending on which
//      instance took it. Data appeared and disappeared as you clicked.
//   2. There was only ever ONE of them, shared by every visitor, so two people
//      using the app edited each other's tasks.
//
// Both are fixed here. A workspace id (from the `tangent_ws` cookie, set by
// middleware) picks a key in the shared store; AsyncLocalStorage keeps that
// workspace's data attached to the request handling it, so concurrent requests
// for different people can never see each other's data.
//
// lib/store.ts still holds all the logic and still looks synchronous — it reads
// the current workspace through a proxy instead of `global`. That kept the fix
// out of all 23 files that call the store.

import { AsyncLocalStorage } from "node:async_hooks";
import { kvGet, kvSet, kvSetAdd, kvSetMembers } from "./kv";
import type {
  Task,
  Plan,
  CalendarDef,
  CalendarEvent,
  UserProfile,
  VoiceLogEntry,
  UserContext,
  Notification,
  ActionRecord,
  PendingConfirmation,
  BriefConfig,
  CanvasFeedConfig,
  PendingBriefBatch,
  Anchor,
  Goal,
  TangentIdea,
} from "./types";
import type { ChatMessage, ChatSession } from "./store";

export interface StoreData {
  tasks: Task[];
  calendars: CalendarDef[];
  events: CalendarEvent[];
  user: UserProfile;
  weeklyPlan: string[];
  voiceLogs: VoiceLogEntry[];
  lastVoiceCommand: string | null;
  lastVoiceResponse: string | null;
  plans: Plan[];
  taskChats: Record<string, ChatMessage[]>;
  chatSessions: ChatSession[];
}

export type TangentSpace = { goal: Goal | null; anchors: Anchor[]; tangents: TangentIdea[] };

/** Everything one workspace owns. Keys match the old `global.__tangent*` names
 *  so lib/store.ts needed no renaming. */
export type WorkspaceData = {
  __tangentStore: StoreData;
  __tangentUserContext: UserContext;
  __tangentNotifications: Notification[];
  __tangentActions: ActionRecord[];
  __tangentPending: PendingConfirmation[];
  __tangentBriefConfig: BriefConfig | null;
  __tangentCanvasFeed: CanvasFeedConfig | null;
  __tangentPendingBriefBatch: PendingBriefBatch | null;
  __tangentSpace: TangentSpace;
};

/** Not persisted: a pending confirmation or an in-flight brief batch belongs to
 *  one attempt and must not come back from storage later. */
const TRANSIENT: (keyof WorkspaceData)[] = ["__tangentPending", "__tangentPendingBriefBatch"];

export function defaultWorkspaceData(): WorkspaceData {
  return {
    __tangentStore: {
      tasks: [],
      calendars: [
        { id: "cal_all", name: "All Calendars", category: "ALL", color: "#c4b5fd" },
        { id: "cal_personal", name: "Personal", category: "personal", color: "#a78bfa" },
        { id: "cal_work", name: "Work", category: "work", color: "#34d399" },
      ],
      events: [],
      user: { displayName: "Tangent User", email: "you@example.com" },
      weeklyPlan: [
        "Mon: Deep work block AM",
        "Wed: Mid-week review",
        "Fri: Week wrap + next week sketch",
      ],
      voiceLogs: [],
      lastVoiceCommand: null,
      lastVoiceResponse: null,
      plans: [],
      taskChats: {},
      chatSessions: [],
    },
    __tangentUserContext: {
      entries: [],
      compressedSummary: "",
      lastUpdated: new Date().toISOString(),
      totalInteractions: 0,
    } as UserContext,
    __tangentNotifications: [],
    __tangentActions: [],
    __tangentPending: [],
    __tangentBriefConfig: null,
    __tangentCanvasFeed: null,
    __tangentPendingBriefBatch: null,
    __tangentSpace: { goal: null, anchors: [], tangents: [] },
  };
}

type Context = { id: string; data: WorkspaceData };

const als = new AsyncLocalStorage<Context>();

// Used only outside a request: `next build`'s module evaluation, a script, a
// test importing the store directly. Never serves a real user's data.
let fallback: Context | null = null;

export function currentWorkspace(): WorkspaceData {
  const ctx = als.getStore();
  if (ctx) return ctx.data;
  if (!fallback) fallback = { id: "__no_request__", data: defaultWorkspaceData() };
  return fallback.data;
}

export function currentWorkspaceId(): string {
  return als.getStore()?.id ?? "__no_request__";
}

const WORKSPACE_INDEX = "tangent:workspaces";
const key = (id: string) => `tangent:ws:${id}`;

/** Fills in anything a stored workspace is missing, so a snapshot written by an
 *  older deploy can't leave a field undefined and crash a page. */
function hydrate(stored: Partial<WorkspaceData> | null): WorkspaceData {
  const base = defaultWorkspaceData();
  if (!stored) return base;
  const merged = { ...base, ...stored } as WorkspaceData;
  merged.__tangentStore = { ...base.__tangentStore, ...(stored.__tangentStore ?? {}) };
  for (const k of TRANSIENT) {
    (merged as Record<string, unknown>)[k] = (base as Record<string, unknown>)[k];
  }
  return merged;
}

export async function loadWorkspace(id: string): Promise<WorkspaceData> {
  const raw = await kvGet(key(id));
  if (!raw) return defaultWorkspaceData();
  try {
    return hydrate(JSON.parse(raw) as Partial<WorkspaceData>);
  } catch (err) {
    console.error("[workspace] stored data unreadable, starting fresh:", (err as Error).message);
    return defaultWorkspaceData();
  }
}

function persistable(data: WorkspaceData): string {
  const copy = { ...data } as Record<string, unknown>;
  for (const k of TRANSIENT) delete copy[k];
  return JSON.stringify(copy);
}

export async function saveWorkspace(id: string, data: WorkspaceData): Promise<void> {
  const ok = await kvSet(key(id), persistable(data));
  if (ok) await kvSetAdd(WORKSPACE_INDEX, id);
}

/** Every workspace that has ever been saved. The cron jobs need this, since they
 *  run without a cookie and so without a workspace of their own. */
export async function allWorkspaceIds(): Promise<string[]> {
  return kvSetMembers(WORKSPACE_INDEX);
}

/**
 * Runs `fn` with `id`'s workspace loaded, then writes it back if it changed.
 *
 * Reads never write, which is what keeps the 2-second poll from racing an edit:
 * the only requests that save are the ones that actually changed something.
 */
export async function withWorkspace<T>(id: string, fn: () => Promise<T> | T): Promise<T> {
  const data = await loadWorkspace(id);
  const before = persistable(data);
  return als.run({ id, data }, async () => {
    try {
      return await fn();
    } finally {
      const after = persistable(data);
      if (after !== before) await saveWorkspace(id, data);
    }
  });
}

/** Lets a background job (cron) act on a workspace it loaded itself. */
export async function runInWorkspace<T>(id: string, data: WorkspaceData, fn: () => Promise<T> | T): Promise<T> {
  const before = persistable(data);
  return als.run({ id, data }, async () => {
    try {
      return await fn();
    } finally {
      const after = persistable(data);
      if (after !== before) await saveWorkspace(id, data);
    }
  });
}

/**
 * Runs `fn` once per stored workspace, each with that workspace loaded.
 *
 * The cron jobs need this. They arrive with no cookie, so before per-workspace
 * storage they operated on whatever single global store their instance had; now
 * they have to visit each workspace explicitly. One workspace failing must not
 * stop the others, so failures are collected rather than thrown.
 */
export async function forEachWorkspace<T>(
  fn: (id: string) => Promise<T> | T
): Promise<{ id: string; result?: T; error?: string }[]> {
  const ids = await allWorkspaceIds();
  const out: { id: string; result?: T; error?: string }[] = [];
  for (const id of ids) {
    try {
      const data = await loadWorkspace(id);
      out.push({ id, result: await runInWorkspace(id, data, () => fn(id)) });
    } catch (err) {
      console.error(`[workspace] ${id} failed:`, (err as Error).message);
      out.push({ id, error: (err as Error).message });
    }
  }
  return out;
}
