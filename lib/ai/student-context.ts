import "server-only";

// One picture of the student for every AI step that decides something: what
// TANGENT has learned about them, their school hours, how much they can take
// on, how full the next two weeks are, what's due, and what they're working
// toward. This is what lets Tangent skip questions it already knows the
// answer to, and place work around a heavy week instead of on top of it.

import { getAllPlans, getAllTasks, getContextAsString, getPathGoals } from "@/lib/store";
import { cleanCourse } from "@/lib/course";
import { describeLoad, formatMinutes } from "@/lib/load";
import { schoolHoursFromTasks } from "@/lib/school-block";
import { isSchoolBlock } from "@/lib/schedule-slots";
import { studentCapacity, studentNow } from "@/lib/spacing";
import { addDaysYMD } from "@/lib/time";
import { formatTime12 } from "@/lib/dates";

const LOOKAHEAD_DAYS = 14;
const MAX_DEADLINES = 15;
const MAX_LISTED = 25;

export type StudentContext = {
  /** Prompt-ready text, sections separated by blank lines. */
  text: string;
  /** False until the student has told Tangent their daily capacity. */
  capacityKnown: boolean;
};

export async function buildStudentContext(): Promise<StudentContext> {
  const [tasks, memory, goals, { cap, known }, now, plans] = await Promise.all([
    getAllTasks(),
    getContextAsString().catch(() => ""),
    getPathGoals().catch(() => []),
    studentCapacity(),
    studentNow(),
    getAllPlans().catch(() => []),
  ]);

  const sections: string[] = [];

  if (memory && memory !== "No user context yet.") {
    sections.push(`WHAT YOU KNOW ABOUT THEM (from past conversations):\n${memory}`);
  }

  const school = schoolHoursFromTasks(tasks);
  if (school) {
    const days = school.days.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ");
    sections.push(`SCHOOL HOURS: ${days}, ${formatTime12(school.start)}–${formatTime12(school.end)}`);
  }

  sections.push(
    known
      ? `DAILY CAPACITY (their own answer): about ${formatMinutes(cap.weekday)} of work on school nights, ${formatMinutes(cap.weekend)} on weekends.`
      : `DAILY CAPACITY: not asked yet. Assuming ${formatMinutes(cap.weekday)} on school nights, ${formatMinutes(cap.weekend)} on weekends.`
  );

  sections.push(`HOW FULL THE NEXT ${LOOKAHEAD_DAYS} DAYS ARE (estimated work vs capacity):\n${describeLoad(tasks, now.date, LOOKAHEAD_DAYS, cap)}`);

  const until = addDaysYMD(now.date, LOOKAHEAD_DAYS);
  const due = tasks
    .filter((t) => !t.completed && t.date >= now.date && t.date <= until && (t.source === "canvas" || t.kind === "school"))
    .filter((t) => t.title.trim().toLowerCase() !== "school")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, MAX_DEADLINES);
  if (due.length > 0) {
    sections.push(`COMING UP FOR SCHOOL:\n${due.map((t) => `- ${t.date}: ${t.title}`).join("\n")}`);
  }

  // The actual work: what's overdue and what's open this week, so "plan my
  // week" starts from their real list instead of asking what's on it.
  const work = tasks.filter((t) => !t.completed && !isSchoolBlock(t));
  const overdue = work.filter((t) => t.date < now.date).sort((a, b) => a.date.localeCompare(b.date));
  if (overdue.length > 0) {
    sections.push(
      `OVERDUE (${overdue.length}):\n${overdue
        .slice(0, MAX_LISTED)
        .map((t) => `- ${t.date}: ${t.title}`)
        .join("\n")}${overdue.length > MAX_LISTED ? `\n- …and ${overdue.length - MAX_LISTED} more` : ""}`
    );
  }
  const weekEnd = addDaysYMD(now.date, 6);
  const week = work
    .filter((t) => t.date >= now.date && t.date <= weekEnd)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (week.length > 0) {
    sections.push(
      `OPEN THIS WEEK (${week.length}):\n${week
        .slice(0, MAX_LISTED)
        .map((t) => `- ${t.date}${t.time && t.time !== "23:59" ? ` ${t.time}` : ""}: ${t.title}${t.source === "canvas" ? " (due)" : ""}`)
        .join("\n")}`
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
  if (classes.size > 0) {
    sections.push(`THEIR CLASSES: ${Array.from(classes).slice(0, 12).join("; ")}`);
  }

  // Projects already under way, so a new ask that overlaps one is recognised
  // as part of it rather than started again from nothing.
  if (plans.length > 0) {
    sections.push(
      `PROJECTS ALREADY UNDER WAY:\n${plans
        .slice(0, 10)
        .map((p) => {
          const steps = tasks.filter((t) => t.planId === p.id);
          const done = steps.filter((t) => t.completed).length;
          const next = steps.filter((t) => !t.completed).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0];
          return `- ${p.title} (${done}/${steps.length} steps done${next ? `; next: ${next.title} on ${next.date}` : ""})`;
        })
        .join("\n")}`
    );
  }

  if (goals.length > 0) {
    sections.push(
      `GOALS THEY'RE WORKING TOWARD (Paths):\n${goals
        .map((g) => `- ${g.title}: ${g.target}${g.deadline ? ` (by ${g.deadline})` : ""}${g.hoursPerWeek ? `, ${g.hoursPerWeek} hrs/week` : ""}`)
        .join("\n")}`
    );
  }

  return { text: sections.join("\n\n"), capacityKnown: known };
}
