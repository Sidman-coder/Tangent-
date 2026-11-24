// The few plain lines in the Calendar rail ("Your next 7 days"). Overnight Phase 5
// heuristic run: the rail said "6 things to do" while the agenda listed one,
// because it counted the onboarding School block (the student's school hours),
// which the calendar, Home and the nav badge all hide. Same filter here.

import { addDaysYMD } from "./time";
import { commitmentOf } from "./task-kind";
import { isOnboardingSchoolTask } from "./school-block";
import type { Task } from "./types";

function dayName(ymd: string, today: string): string {
  if (ymd === today) return "today";
  if (ymd === addDaysYMD(today, 1)) return "tomorrow";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long" });
}

export function weekLines(tasks: Task[], today: string): string[] {
  const days = Array.from({ length: 7 }, (_, i) => addDaysYMD(today, i));
  const inWeek = tasks.filter((t) => !isOnboardingSchoolTask(t) && t.date >= days[0] && t.date <= days[6]);
  if (inWeek.length === 0) return ["Nothing on your calendar for the next 7 days."];
  const open = inWeek.filter((t) => !t.completed);
  const perDay = days.map((d) => ({ d, n: open.filter((t) => t.date === d).length }));
  const busiest = [...perDay].sort((a, b) => b.n - a.n)[0];
  const free = perDay.filter((p) => p.n === 0).map((p) => dayName(p.d, today));
  const mustDo = open.filter((t) => commitmentOf(t) === "fixed" || t.source === "canvas").length;
  const lines = [`${open.length} thing${open.length === 1 ? "" : "s"} to do in the next 7 days${mustDo ? `, ${mustDo} at a set time or date` : ""}.`];
  if (busiest.n > 1) lines.push(`Busiest: ${dayName(busiest.d, today)}, with ${busiest.n}.`);
  if (free.length > 0) lines.push(free.length === 1 ? `Open: ${free[0]}.` : `Open: ${free.slice(0, 3).join(", ")}${free.length > 3 ? " and more" : ""}.`);
  return lines;
}
