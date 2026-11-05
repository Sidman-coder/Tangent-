// The Chats library (/ai): every task, project and general chat in one list,
// newest first. Pure, so it is tested without a database.

import { projectSeries, taskSeries, SERIES_KEYS, type SeriesKey } from "../task-colors";
import type { ChatSession, Plan, Task } from "../types";
import { scopeOfSession, type ChatScopeType } from "./scope";

export type LibraryEntry = {
  id: string;
  scope: ChatScopeType;
  title: string;
  preview: string;
  color: SeriesKey | "neutral";
  updatedAt: string;
  /** Where the entry opens; null for a task chat (it opens in the task sheet). */
  href: string | null;
  taskId?: string;
  /** Its task or project was deleted: it opens read-only on Home. */
  orphan?: boolean;
};

export type LibraryTab = "all" | "projects" | "tasks" | "general";

function previewOf(session: ChatSession): string {
  if (session.summary?.trim()) return session.summary.trim().slice(0, 140);
  const last = [...session.messages].reverse().find((m) => m.content.trim());
  if (!last) return "";
  // Saved cards carry a JSON tail (components/console/turns withCard); show the words.
  const words = last.content.split("<!-- tangent:card")[0].replace(/\s+/g, " ").trim();
  return words.length > 140 ? `${words.slice(0, 139).trimEnd()}…` : words;
}

const asSeries = (s: string): SeriesKey | "neutral" => ((SERIES_KEYS as string[]).includes(s) ? (s as SeriesKey) : "neutral");

export function libraryEntries(sessions: ChatSession[], tasks: Task[], plans: Plan[]): LibraryEntry[] {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const planById = new Map(plans.map((p) => [p.id, p]));
  const entries: LibraryEntry[] = [];
  for (const s of sessions) {
    // An empty thread (opened, never used) isn't worth listing.
    if (s.messages.length === 0) continue;
    const scope = scopeOfSession(s);
    const base = { id: s.id, preview: previewOf(s), updatedAt: s.updatedAt };
    if (scope.type === "project") {
      const plan = planById.get(scope.projectId);
      entries.push(
        plan
          ? { ...base, scope: "project", title: plan.title, color: projectSeries(plan.color, plan.id), href: `/projects/${plan.id}?chat=1` }
          : { ...base, scope: "project", title: s.title, color: "neutral", href: `/?chat=${s.id}`, orphan: true }
      );
    } else if (scope.type === "task") {
      const task = taskById.get(scope.taskId);
      entries.push(
        task
          ? { ...base, scope: "task", title: task.title, color: asSeries(taskSeries(task, plans)), href: null, taskId: task.id }
          : { ...base, scope: "task", title: s.title, color: "neutral", href: `/?chat=${s.id}`, orphan: true }
      );
    } else {
      entries.push({ ...base, scope: "general", title: s.title, color: "neutral", href: `/?chat=${s.id}` });
    }
  }
  return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

const TAB_SCOPE: Record<Exclude<LibraryTab, "all">, ChatScopeType> = { projects: "project", tasks: "task", general: "general" };

export function filterLibrary(entries: LibraryEntry[], tab: LibraryTab, query: string): LibraryEntry[] {
  const q = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (tab === "all" || e.scope === TAB_SCOPE[tab]) &&
      (!q || e.title.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q))
  );
}
