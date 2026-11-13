// Round 5A, 1.6: bulk actions are not planning. "Delete all my tasks and
// projects", "clear my chat history", "move all today's tasks to tomorrow" and
// "mark all done" are commands about what they already have. They go to a
// confirm card with exact counts; they never plan and never ask grill
// questions.
//
// Two halves, both pure (no model, no database):
//   parseBulkAction  words -> an action, or null when it isn't a bulk action.
//                    Strict on purpose: "delete my SAT tasks" has a topic in
//                    it, so it returns null and the existing scoped delete
//                    (lib/delete-scope.ts) handles it.
//   planBulk         an action + what they have -> the card text and the ids
//                    it will touch, or "nothing to do".

import { emptiedPlans } from "../delete-scope";
import { addDaysYMD, weekdayOf } from "../time";

export type BulkTarget = "tasks" | "projects" | "chats";
export type BulkScope = "all" | "today" | "overdue" | "week";
export type MoveDest = { kind: "today" } | { kind: "tomorrow" } | { kind: "next_week" } | { kind: "weekday"; day: number };

export type BulkAction =
  | { kind: "delete"; targets: BulkTarget[]; scope: BulkScope }
  | { kind: "move"; scope: BulkScope; to: MoveDest }
  | { kind: "done"; scope: BulkScope };

/** The slice of a task a bulk action reads. */
export type BulkTask = { id: string; title: string; date: string; time: string; completed: boolean; planId?: string | null; commitment?: string | null };
export type BulkPlan = { id: string; title: string };

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function norm(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/'s\b/g, "s")
    .replace(/'/g, "")
    .replace(/[.!?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LEAD = /^(?:(?:hey |ok |okay |so )?(?:tangent )?)?(?:(?:please|pls|can you|could you|would you|will you|i want you to|i want to|i need you to|i would like to|go ahead and|just) )+/;
const TRAIL = /(?: (?:please|pls|now|for me|thanks|thank you|right now|ok|okay))+$/;

// Words that carry no meaning for these commands.
const FILLER = new Set(["all", "every", "each", "my", "the", "of", "whole", "entire", "out", "up", "from", "on", "in", "i", "have", "ever", "currently", "existing", "old", "a", "me", "and", "also", "plus", "&", ",", "everything", "it", "that", "those", "these", "them", "stuff", "things", "ones", "items", "item"]);

function canonical(s: string): string {
  return s
    .replace(/\b(?:chat|conversation|message) (?:history|sessions?|logs?)\b/g, "chats")
    .replace(/\b(?:conversations?|messages?)\b/g, "chats")
    .replace(/\bchat\b/g, "chats")
    .replace(/\bchatss\b/g, "chats")
    .replace(/\bto[- ]?dos?\b/g, "tasks")
    .replace(/\b(?:todos?)\b/g, "tasks")
    .replace(/\b(?:this|the|current) (?:week|weeks)\b|\bweeks?\b/g, "week")
    .replace(/\bthis weekend\b/g, "week")
    .replace(/\b(?:today|todays|tonight)\b/g, "today")
    .replace(/\b(?:tomorrows?|tmrw)\b/g, "tomorrow")
    .replace(/\b(?:past due|late|overdue)\b/g, "overdue")
    .replace(/\bget rid of\b/g, "delete")
    .replace(/,/g, " , ");
}

type Words = { targets: Set<BulkTarget>; scope: BulkScope | null; everything: boolean; unknown: string[] };

/** Reads the nouns, the time word and what's left over. */
function readWords(rest: string): Words {
  const out: Words = { targets: new Set(), scope: null, everything: false, unknown: [] };
  const sentence = canonical(rest);
  // "everything" / "it all" / a bare "all" means the whole schedule.
  if (/\beverything\b|\bit all\b|\b(?:stuff|things)\b|^all$/.test(sentence.trim())) out.everything = true;
  for (const w of sentence.split(" ").filter(Boolean)) {
    if (/^(?:tasks?|schedule|calendar|events?|assignments?|steps?|reminders?)$/.test(w)) out.targets.add("tasks");
    else if (/^(?:projects?|plans?|goals?|tangents?)$/.test(w)) out.targets.add("projects");
    else if (w === "chats") out.targets.add("chats");
    else if (w === "today" || w === "overdue" || w === "week") out.scope = w;
    else if (FILLER.has(w)) continue;
    else out.unknown.push(w);
  }
  return out;
}

const DELETE = /^(?:delete|remove|clear|wipe|erase|trash|empty|reset|dump|nuke|cancel)\b/;
const MOVE = /^(?:move|push|shift|reschedule|bump|postpone|put|carry|roll)\b/;
const DONE_A = /^(?:mark|set|tick|check|cross|count|flag)\b/;
const DONE_B = /^(?:complete|finish|finished|done with)\b/;

function destOf(s: string): MoveDest | null {
  const t = s.trim();
  if (t === "today") return { kind: "today" };
  if (t === "tomorrow") return { kind: "tomorrow" };
  if (/^(?:next week|week|a week|1 week|one week|next week s)$/.test(t)) return { kind: "next_week" };
  const day = DAYS.findIndex((d) => t === d || t === `next ${d}` || t === `on ${d}` || t === `this ${d}`);
  if (day >= 0) return { kind: "weekday", day };
  return null;
}

/**
 * Words -> a bulk action, or null. Anything with a word it doesn't know
 * ("my SAT tasks", "the chem project") is not a bulk action.
 */
export function parseBulkAction(text: string): BulkAction | null {
  let s = norm(text);
  for (let i = 0; i < 3; i++) s = s.replace(LEAD, "").trim();
  s = s.replace(TRAIL, "").trim();
  if (!s) return null;

  // ── Delete / clear ────────────────────────────────────────────────────────
  if (DELETE.test(s)) {
    const rest = s.replace(DELETE, "").trim();
    const w = readWords(rest);
    if (w.unknown.length > 0) return null;
    // "clear today" or "delete overdue" name no noun: a time scope alone is tasks.
    const named = w.targets.size > 0;
    if (!named && !w.everything && !w.scope) return null;
    const targets: BulkTarget[] = named ? (["tasks", "projects", "chats"] as BulkTarget[]).filter((t) => w.targets.has(t)) : ["tasks", "projects"];
    const scope: BulkScope = w.scope ?? "all";
    // A day or week only narrows tasks; "delete today's projects" is unclear.
    if (scope !== "all" && (targets.length !== 1 || targets[0] !== "tasks")) return null;
    return { kind: "delete", targets, scope };
  }

  // ── Move all ──────────────────────────────────────────────────────────────
  if (MOVE.test(s)) {
    const m = /^(?:\w+)\s+(.*?)\s+(?:to|until|till|onto|for|by|into)\s+(.+)$/.exec(s);
    if (!m) return null;
    const to = destOf(m[2].replace(/^(?:the )/, ""));
    if (!to) return null;
    // "move today's tasks to today" does nothing.
    const w = readWords(m[1].replace(/\b(?:are |is )?due\b/g, ""));
    if (w.unknown.length > 0) return null;
    if (w.targets.size > 0 && !w.targets.has("tasks")) return null;
    // It has to say "all", a time word, or a noun: "move chem to friday" is one task.
    if (!/\b(?:all|every|everything)\b/.test(m[1]) && !w.scope) return null;
    const scope: BulkScope = w.scope ?? "all";
    if (to.kind === "today" && scope === "today") return null;
    return { kind: "move", scope, to };
  }

  // ── Mark all done ─────────────────────────────────────────────────────────
  const markDone = DONE_A.test(s) ? /^\w+\s+(.*?)\s*(?:as |off as )?(?:done|complete|completed|finished|off|checked)$/.exec(s) : null;
  const checkOff = /^(?:check|tick|cross) off\s+(.*)$/.exec(s);
  const completeAll = DONE_B.test(s) ? /^(?:complete|finish|finished|done with)\s+(.*)$/.exec(s) : null;
  const body = markDone ? markDone[1] : checkOff ? checkOff[1] : completeAll ? completeAll[1] : null;
  if (body !== null) {
    const w = readWords(body.replace(/\b(?:off|as)\b/g, ""));
    if (w.unknown.length > 0) return null;
    if (w.targets.size > 0 && !w.targets.has("tasks")) return null;
    if (w.targets.has("projects") || w.targets.has("chats")) return null;
    // "mark all done": says all, a time word or tasks. "mark chem done" is one task.
    if (!/\b(?:all|every|everything)\b/.test(body) && !w.scope) return null;
    return { kind: "done", scope: w.scope ?? "all" };
  }
  return null;
}

// ── Counting and the card ───────────────────────────────────────────────────

export type BulkInput = { tasks: readonly BulkTask[]; plans: readonly BulkPlan[]; chatCount: number; today: string };

function weekBounds(today: string): { start: string; end: string } {
  const dow = weekdayOf(today); // 0 = Sunday
  const sinceMonday = (dow + 6) % 7;
  const start = addDaysYMD(today, -sinceMonday);
  return { start, end: addDaysYMD(start, 6) };
}

export function inScope(task: BulkTask, scope: BulkScope, today: string): boolean {
  if (scope === "all") return true;
  if (scope === "today") return task.date === today;
  if (scope === "overdue") return !task.completed && !!task.date && task.date < today;
  const { start, end } = weekBounds(today);
  return task.date >= start && task.date <= end;
}

export function destDate(to: MoveDest, taskDate: string, today: string): string {
  switch (to.kind) {
    case "today":
      return today;
    case "tomorrow":
      return addDaysYMD(today, 1);
    case "next_week":
      return addDaysYMD(taskDate && taskDate > today ? taskDate : today, 7);
    case "weekday": {
      const ahead = (to.day - weekdayOf(today) + 7) % 7;
      return addDaysYMD(today, ahead === 0 ? 7 : ahead);
    }
  }
}

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function list(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const SCOPE_WORDS: Record<BulkScope, string> = { all: "", today: " from today", overdue: " that are overdue", week: " from this week" };

export type BulkPlanResult =
  | { kind: "empty"; message: string }
  | {
      kind: "confirm";
      message: string;
      /** Tasks to delete (delete), move or mark done. */
      taskIds: string[];
      /** Delete: the projects that go. */
      planIds: string[];
      /** Delete: all chats go. They can't be brought back. */
      chats: boolean;
      /** Move: where each task goes. */
      moves: { taskId: string; date: string }[];
      /** Undo brings everything back except chats. */
      undoable: boolean;
    };

/** What a bulk action would do, with the counts for its card. Never changes anything. */
export function planBulk(action: BulkAction, input: BulkInput): BulkPlanResult {
  const { tasks, plans, chatCount, today } = input;
  const none = { taskIds: [], planIds: [], chats: false, moves: [] as { taskId: string; date: string }[] };

  if (action.kind === "delete") {
    const wantTasks = action.targets.includes("tasks");
    const wantPlans = action.targets.includes("projects");
    const wantChats = action.targets.includes("chats");
    const taskIds = new Set<string>();
    const planIds = wantPlans ? plans.map((p) => p.id) : [];
    if (wantTasks) for (const t of tasks) if (inScope(t, action.scope, today)) taskIds.add(t.id);
    // Tasks only: a project left with no steps goes too, as in lib/delete-scope.ts (A2).
    if (wantTasks && !wantPlans) {
      for (const p of emptiedPlans(tasks.filter((t) => taskIds.has(t.id)), tasks, plans)) planIds.push(p.id);
    }
    // A project goes with its steps: they'd be left with no home.
    let stepsOfProjects = 0;
    if (wantPlans) {
      const gone = new Set(planIds);
      for (const t of tasks) if (t.planId && gone.has(t.planId) && !taskIds.has(t.id)) (taskIds.add(t.id), stepsOfProjects++);
    }
    const chats = wantChats && chatCount > 0;
    if (taskIds.size === 0 && planIds.length === 0 && !chats) {
      const what = list(action.targets.map((t) => (t === "tasks" ? "tasks" : t === "projects" ? "projects" : "chats")));
      return { kind: "empty", message: `You don't have any ${what}${SCOPE_WORDS[action.scope]} to delete.` };
    }
    const parts: string[] = [];
    if (wantTasks && taskIds.size - stepsOfProjects > 0) parts.push(n(taskIds.size - stepsOfProjects, "task"));
    if (planIds.length > 0) parts.push(n(planIds.length, "project"));
    if (chats) parts.push(n(chatCount, "chat"));
    let message = `Delete ${list(parts)}${wantTasks ? SCOPE_WORDS[action.scope] : ""}?`;
    if (!wantTasks && stepsOfProjects > 0) message = `Delete ${list(parts)} and their ${n(stepsOfProjects, "step")}?`;
    else if (wantTasks && wantPlans && stepsOfProjects > 0) message = `Delete ${list(parts)}, with ${n(stepsOfProjects, "project step")}?`;
    const undoable = taskIds.size > 0 || planIds.length > 0;
    message += chats ? (undoable ? " Undo brings the tasks and projects back, but not the chats." : " This can't be undone.") : " You can undo this.";
    return { kind: "confirm", message, ...none, taskIds: Array.from(taskIds), planIds, chats, undoable };
  }

  // Move and done only touch what's still open; fixed events keep their time.
  const open = tasks.filter((t) => !t.completed && inScope(t, action.scope, today));
  if (action.kind === "done") {
    if (open.length === 0) return { kind: "empty", message: `There's nothing to mark done${SCOPE_WORDS[action.scope]}.` };
    return { kind: "confirm", message: `Mark ${n(open.length, "task")}${SCOPE_WORDS[action.scope]} as done? You can undo this.`, ...none, taskIds: open.map((t) => t.id), undoable: true };
  }
  const movable = open.filter((t) => t.commitment !== "fixed");
  const fixed = open.length - movable.length;
  const moves = movable.map((t) => ({ taskId: t.id, date: destDate(action.to, t.date, today) })).filter((m, i) => m.date !== movable[i].date);
  if (moves.length === 0) return { kind: "empty", message: `There's nothing to move${SCOPE_WORDS[action.scope]}.` };
  const where = action.to.kind === "weekday" ? DAYS[action.to.day][0].toUpperCase() + DAYS[action.to.day].slice(1) : action.to.kind === "next_week" ? "next week" : action.to.kind;
  const stay = fixed > 0 ? ` ${n(fixed, "fixed event")} stay${fixed === 1 ? "s" : ""} put.` : "";
  return { kind: "confirm", message: `Move ${n(moves.length, "task")}${SCOPE_WORDS[action.scope]} to ${where}?${stay} You can undo this.`, ...none, moves, taskIds: moves.map((m) => m.taskId), undoable: true };
}
