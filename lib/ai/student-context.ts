import "server-only";

// One picture of the student for every AI step that decides something: what
// TANGENT has learned about them, their school hours, how much they can take
// on, how full the next two weeks are, what's due, and what they're working
// toward. This is what lets Tangent skip questions it already knows the
// answer to, and place work around a heavy week instead of on top of it.
//
// Round 4 (Layer 5, docs/tangent/CONTEXT-ENGINE.md): this is the context
// pack. The student's facts are ranked for what the call is for (top 10–15,
// lib/student/context-pack.ts), the observation log adds how they really
// work, a project's own state comes first when there is one, and the whole is
// fitted to a token budget. The facts shown are recorded for the request so
// the plan can say "Used: …" (never the prompt itself).

import { getAllPlans, getAllTasks, getPathGoals, getUserContext, markFactsUsed } from "@/lib/store";
import { noteFactsUsed, trackPending } from "@/lib/request-context";
import { readStepEvents } from "@/lib/student/step-events";
import { behaviourLines, calibrationLines } from "@/lib/student/observations";
import { DEFAULT_BUDGET, KEEP, factLine, fitBudget, rankFacts, type ContextPurpose, type PackSection } from "@/lib/student/context-pack";
import { cleanCourse } from "@/lib/course";
import { describeLoad, formatMinutes } from "@/lib/load";
import { schoolHoursFromTasks } from "@/lib/school-block";
import { isBusyBlock } from "@/lib/schedule-slots";
import { studentCapacity, studentNow } from "@/lib/spacing";
import { addDaysYMD } from "@/lib/time";
import { formatTime12 } from "@/lib/dates";

const LOOKAHEAD_DAYS = 14;
const MAX_DEADLINES = 15;
const MAX_LISTED = 25;

export type StudentContext = {
  /** Prompt-ready text, sections separated by blank lines. */
  text: string;
  /** The facts in `text`, for "Used: …". */
  factsUsed: { id: string; text: string }[];
  /** Rough size of `text`. */
  tokens: number;
  /** False until the student has told Tangent their daily capacity. */
  capacityKnown: boolean;
  /** Projects under way, for matching a new ask to one (lib/project-match.ts). */
  projects: { id: string; title: string }[];
};

export type ContextPackOptions = {
  /** What the call is for; decides which facts matter most. */
  purpose?: ContextPurpose;
  /** The project (plan) this call is about: its state goes first. */
  projectId?: string | null;
  /** What the student just said, so facts about it rank higher. */
  query?: string;
  /** Token budget for the whole picture. */
  budget?: number;
};

const BUDGET: Partial<Record<ContextPurpose, number>> = { plan: 3000, extend: 3000, path: 3000, chat: 2000, voice: 1600, brief: 1600 };

/** The context pack for one AI call. See the header. */
export function buildContextPack(purpose: ContextPurpose, projectId?: string | null, query?: string): Promise<StudentContext> {
  return buildStudentContext({ purpose, projectId, query });
}

function rankEntries(entries: NonNullable<Awaited<ReturnType<typeof getUserContext>>>["entries"], purpose: ContextPurpose, query: string, projectId: string | null) {
  return rankFacts(
    entries.map((e) => ({
      id: e.id,
      text: e.fact,
      factCategory: e.factCategory,
      factSource: e.factSource,
      confidence: e.confidence,
      timestamp: e.timestamp,
      lastConfirmedAt: e.lastConfirmedAt,
      projectId: e.projectId,
      unconfirmed: e.unconfirmed,
    })),
    { purpose, query, projectId },
  );
}

function recordUsed(facts: { id: string; text: string }[]): void {
  if (!facts.length) return;
  noteFactsUsed(facts);
  try {
    trackPending(markFactsUsed(facts.map((f) => f.id)));
  } catch {
    // Outside a request (a script): nothing to count.
  }
}

/** Just the ranked facts, for calls that already describe the calendar
 *  themselves (daily brief, nudges, the voice agent). Same ranking and
 *  "guess" labels as the full pack. */
export async function studentFactsText(purpose: ContextPurpose, query = ""): Promise<string> {
  const memory = await getUserContext().catch(() => null);
  const ranked = rankEntries(memory?.entries ?? [], purpose, query, null);
  recordUsed(ranked.map((f) => ({ id: f.id, text: f.text })));
  const lines = ranked.map(factLine).join("\n");
  if (memory?.compressedSummary) return `EARLIER (summary):\n${memory.compressedSummary.slice(0, 800)}${lines ? `\n\nMOST RELEVANT:\n${lines}` : ""}`;
  return lines || "No user context yet.";
}

export async function buildStudentContext(opts: ContextPackOptions = {}): Promise<StudentContext> {
  const purpose = opts.purpose ?? "chat";
  const [tasks, memory, goals, { cap, known }, now, plans, events] = await Promise.all([
    getAllTasks(),
    getUserContext().catch(() => null),
    getPathGoals().catch(() => []),
    studentCapacity(),
    studentNow(),
    getAllPlans().catch(() => []),
    readStepEvents().catch(() => []),
  ]);

  const sections: PackSection[] = [];
  const push = (key: string, priority: number, text: string) => sections.push({ key, priority, text });

  // Today, so nothing offers a date that has already passed.
  const [ty, tm, td] = now.date.split("-").map(Number);
  const today = new Date(ty, tm - 1, td).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  push("today", KEEP, `TODAY: ${today} (${now.date})`);

  // The project this call is about, before anything general.
  const project = opts.projectId ? plans.find((p) => p.id === opts.projectId) : undefined;
  if (project) {
    const steps = tasks.filter((t) => t.planId === project.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const done = steps.filter((t) => t.completed);
    const open = steps.filter((t) => !t.completed);
    push(
      "project",
      95,
      [
        `THIS PROJECT: ${project.title}${project.description ? ` — ${project.description.slice(0, 300)}` : ""}`,
        `${done.length} of ${steps.length} steps done.`,
        done.length ? `Done lately: ${done.slice(-3).map((t) => t.title).join("; ")}` : "",
        open.length ? `Still open:\n${open.slice(0, 8).map((t) => `- ${t.date}: ${t.title}${t.date < now.date ? " (missed)" : ""}`).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  // What Tangent knows about them: the facts that matter for this call.
  const ranked = rankEntries(memory?.entries ?? [], purpose, [opts.query, project?.title].filter(Boolean).join(" "), opts.projectId ?? null);
  if (ranked.length) push("facts", 90, `WHAT YOU KNOW ABOUT THEM (most relevant first):\n${ranked.map(factLine).join("\n")}`);
  if (memory?.compressedSummary) push("summary", 20, `EARLIER (summary of older conversations):\n${memory.compressedSummary.slice(0, 1200)}`);

  // How they really work, from what they did with past steps.
  const calibration = [...calibrationLines(events), ...behaviourLines(events)];
  if (calibration.length) push("calibration", 85, `HOW THEY ACTUALLY WORK (observed):\n${calibration.map((l) => `- ${l}`).join("\n")}`);

  const school = schoolHoursFromTasks(tasks);
  if (school) {
    const days = school.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
    push("school", 80, `SCHOOL HOURS: ${days}, ${formatTime12(school.start)}–${formatTime12(school.end)}`);
  }

  push(
    "capacity",
    KEEP,
    known
      ? `DAILY CAPACITY (their own answer): about ${formatMinutes(cap.weekday)} of work on school nights, ${formatMinutes(cap.weekend)} on weekends.`
      : `DAILY CAPACITY: not asked yet. Assuming ${formatMinutes(cap.weekday)} on school nights, ${formatMinutes(cap.weekend)} on weekends.`,
  );

  push("load", 70, `HOW FULL THE NEXT ${LOOKAHEAD_DAYS} DAYS ARE (estimated work vs capacity):\n${describeLoad(tasks, now.date, LOOKAHEAD_DAYS, cap)}`);

  const until = addDaysYMD(now.date, LOOKAHEAD_DAYS);
  const due = tasks
    .filter((t) => !t.completed && t.date >= now.date && t.date <= until && (t.source === "canvas" || t.kind === "school"))
    .filter((t) => t.title.trim().toLowerCase() !== "school")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_DEADLINES);
  if (due.length > 0) push("due", 60, `COMING UP FOR SCHOOL:\n${due.map((t) => `- ${t.date}: ${t.title}`).join("\n")}`);

  // The actual work: what's overdue and what's open this week, so "plan my
  // week" starts from their real list instead of asking what's on it.
  const work = tasks.filter((t) => !t.completed && !isBusyBlock(t));
  const overdue = work.filter((t) => t.date < now.date).sort((a, b) => a.date.localeCompare(b.date));
  if (overdue.length > 0) {
    push(
      "overdue",
      65,
      `OVERDUE (${overdue.length}):\n${overdue
        .slice(0, MAX_LISTED)
        .map((t) => `- ${t.date}: ${t.title}`)
        .join("\n")}${overdue.length > MAX_LISTED ? `\n- …and ${overdue.length - MAX_LISTED} more` : ""}`,
    );
  }
  const weekEnd = addDaysYMD(now.date, 6);
  const week = work
    .filter((t) => t.date >= now.date && t.date <= weekEnd)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (week.length > 0) {
    push(
      "week",
      75,
      `OPEN THIS WEEK (${week.length}):\n${week
        .slice(0, MAX_LISTED)
        .map((t) => `- ${t.date}${t.time && t.time !== "23:59" ? ` ${t.time}` : ""}: ${t.title}${t.source === "canvas" ? " (due)" : ""}`)
        .join("\n")}`,
    );
  }

  // Their classes, by the names Canvas uses, so "my chem final" can be matched
  // to the real class instead of asking which one.
  const classes = new Set<string>();
  for (const t of tasks) {
    if (t.source !== "canvas") continue;
    const m = /\[([^\]]+)\]?\s*$/.exec(t.title);
    const name = m ? cleanCourse(m[1]) : "";
    if (name) classes.add(name);
  }
  if (classes.size > 0) push("classes", 40, `THEIR CLASSES: ${Array.from(classes).slice(0, 12).join("; ")}`);

  // Projects already under way, so a new ask that overlaps one is recognised
  // as part of it rather than started again from nothing.
  if (plans.length > 0) {
    push(
      "projects",
      50,
      `PROJECTS ALREADY UNDER WAY:\n${plans
        .slice(0, 10)
        .map((p) => {
          const steps = tasks.filter((t) => t.planId === p.id);
          const done = steps.filter((t) => t.completed).length;
          const next = steps.filter((t) => !t.completed).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
          return `- ${p.title} (${done}/${steps.length} steps done${next ? `; next: ${next.title} on ${next.date}` : ""})`;
        })
        .join("\n")}`,
    );
  }

  if (goals.length > 0) {
    push(
      "goals",
      purpose === "path" ? 92 : 55,
      `GOALS THEY'RE WORKING TOWARD (Paths):\n${goals
        .map((g) => `- ${g.title}: ${g.target}${g.deadline ? ` (by ${g.deadline})` : ""}${g.hoursPerWeek ? `, ${g.hoursPerWeek} hrs/week` : ""}`)
        .join("\n")}`,
    );
  }

  const fitted = fitBudget(sections, opts.budget ?? BUDGET[purpose] ?? DEFAULT_BUDGET);
  const factsUsed = fitted.dropped.includes("facts") ? [] : ranked.map((f) => ({ id: f.id, text: f.text }));
  recordUsed(factsUsed);
  return {
    text: fitted.text,
    factsUsed,
    tokens: fitted.tokens,
    capacityKnown: known,
    projects: plans.map((p) => ({ id: p.id, title: p.title })),
  };
}
