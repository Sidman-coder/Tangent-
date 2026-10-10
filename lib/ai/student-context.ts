import "server-only";

// One picture of the student for every AI step that decides something: what
// TANGENT has learned about them, their school hours, how much they can take
// on, how full the next two weeks are, what's due, and what they're working
// toward. This is what lets Tangent skip questions it already knows the
// answer to, and place work around a heavy week instead of on top of it.

import { getAllTasks, getContextAsString, getPathGoals } from "@/lib/store";
import { describeLoad, formatMinutes } from "@/lib/load";
import { schoolHoursFromTasks } from "@/lib/school-block";
import { studentCapacity, studentNow } from "@/lib/spacing";
import { addDaysYMD } from "@/lib/time";
import { formatTime12 } from "@/lib/dates";

const LOOKAHEAD_DAYS = 14;
const MAX_DEADLINES = 15;

export type StudentContext = {
  /** Prompt-ready text, sections separated by blank lines. */
  text: string;
  /** False until the student has told Tangent their daily capacity. */
  capacityKnown: boolean;
};

export async function buildStudentContext(): Promise<StudentContext> {
  const [tasks, memory, goals, { cap, known }, now] = await Promise.all([
    getAllTasks(),
    getContextAsString().catch(() => ""),
    getPathGoals().catch(() => []),
    studentCapacity(),
    studentNow(),
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

  if (goals.length > 0) {
    sections.push(
      `GOALS THEY'RE WORKING TOWARD (Paths):\n${goals
        .map((g) => `- ${g.title}: ${g.target}${g.deadline ? ` (by ${g.deadline})` : ""}${g.hoursPerWeek ? `, ${g.hoursPerWeek} hrs/week` : ""}`)
        .join("\n")}`
    );
  }

  return { text: sections.join("\n\n"), capacityKnown: known };
}
