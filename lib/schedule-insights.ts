import type { Task } from "./types";

export type ScheduleInsight = {
  title: string;
  detail: string;
  tone: "neutral" | "positive" | "warning";
};

type CalendarDate = { year: number; month: number; day: number };
type TimeOfDay = "morning" | "afternoon" | "evening";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
};

function readCalendarDate(value: string): CalendarDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function dateAtLocalNoon(date: CalendarDate): Date {
  return new Date(date.year, date.month - 1, date.day, 12);
}

function toYmd(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
}

function isValidTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) < 24 && Number(match[2]) < 60;
}

function timeOfDay(value: string): TimeOfDay | null {
  if (!isValidTime(value)) return null;

  const hour = Number(value.slice(0, 2));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function formatAverage(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

function currentWeekStart(now: Date): Date {
  const localNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  const daysSinceMonday = (localNoon.getDay() + 6) % 7;
  return addDays(localNoon, -daysSinceMonday);
}

function isAcademicTask(task: Task): boolean {
  return task.kind === "school" || task.kind === "academic-ec";
}

function fallbackInsight(): ScheduleInsight {
  return {
    title: "Your schedule pulse",
    detail: "Add scheduled tasks to see patterns in your week.",
    tone: "neutral",
  };
}

export function getMonthDensity(tasks: Task[], year: number, monthIndex: number): Map<string, number> {
  const density = new Map<string, number>();
  if (!Number.isInteger(year) || !Number.isInteger(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return density;
  }

  for (const task of tasks) {
    const date = readCalendarDate(task.date);
    if (!date || date.year !== year || date.month !== monthIndex + 1) continue;
    density.set(task.date, (density.get(task.date) ?? 0) + 1);
  }

  return density;
}

export function getSchedulePulse(tasks: Task[], now: Date = new Date()): ScheduleInsight {
  if (Number.isNaN(now.getTime())) return fallbackInsight();

  const validTasks = tasks.filter((task) => readCalendarDate(task.date) !== null);
  if (validTasks.length === 0) return fallbackInsight();

  const weekStart = currentWeekStart(now);
  const nextWeekStart = addDays(weekStart, 7);
  const previousFourWeeksStart = addDays(weekStart, -28);
  const weekStartYmd = toYmd(weekStart);
  const nextWeekStartYmd = toYmd(nextWeekStart);
  const previousFourWeeksStartYmd = toYmd(previousFourWeeksStart);

  const currentWeekTasks = validTasks.filter(
    (task) => task.date >= weekStartYmd && task.date < nextWeekStartYmd
  );
  const previousFourWeekTasks = validTasks.filter(
    (task) => task.date >= previousFourWeeksStartYmd && task.date < weekStartYmd
  );
  const previousFourWeekAverage = previousFourWeekTasks.length / 4;

  if (
    previousFourWeekTasks.length > 0 &&
    currentWeekTasks.length >= 5 &&
    currentWeekTasks.length >= previousFourWeekAverage + 2
  ) {
    return {
      title: "A heavier week than usual",
      detail: `This week has ${currentWeekTasks.length} scheduled tasks, above your prior four-week average of ${formatAverage(previousFourWeekAverage)}.`,
      tone: "warning",
    };
  }

  const scheduledEvenings = new Set<string>();
  for (const task of currentWeekTasks) {
    if (timeOfDay(task.time) === "evening") scheduledEvenings.add(task.date);
  }
  const openEvenings = 7 - scheduledEvenings.size;

  if (openEvenings >= 3) {
    return {
      title: "Open evenings this week",
      detail: `${openEvenings} evenings have no tasks scheduled from 5 PM onward.`,
      tone: "positive",
    };
  }

  const academicTimes = currentWeekTasks
    .filter(isAcademicTask)
    .map((task) => timeOfDay(task.time))
    .filter((time): time is TimeOfDay => time !== null);
  const academicCounts: Record<TimeOfDay, number> = { morning: 0, afternoon: 0, evening: 0 };
  for (const time of academicTimes) academicCounts[time] += 1;
  const dominantAcademicTime = (Object.keys(academicCounts) as TimeOfDay[]).reduce(
    (dominant, time) => (academicCounts[time] > academicCounts[dominant] ? time : dominant),
    "morning"
  );
  const dominantAcademicCount = academicCounts[dominantAcademicTime];

  if (academicTimes.length >= 3 && dominantAcademicCount / academicTimes.length >= 0.6) {
    return {
      title: `Academic work clusters in the ${TIME_OF_DAY_LABELS[dominantAcademicTime]}`,
      detail: `${dominantAcademicCount} of ${academicTimes.length} academic tasks this week are scheduled in the ${TIME_OF_DAY_LABELS[dominantAcademicTime]}.`,
      tone: "neutral",
    };
  }

  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const task of validTasks) {
    const date = readCalendarDate(task.date);
    if (date) weekdayCounts[dateAtLocalNoon(date).getDay()] += 1;
  }
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const busiestWeekday = weekdayOrder.reduce(
    (busiest, day) => (weekdayCounts[day] > weekdayCounts[busiest] ? day : busiest),
    weekdayOrder[0]
  );
  const busiestWeekdayCount = weekdayCounts[busiestWeekday];

  if (busiestWeekdayCount >= 2) {
    const tiedDays = weekdayCounts.filter((count) => count === busiestWeekdayCount).length;
    return {
      title: `${DAY_NAMES[busiestWeekday]}${tiedDays > 1 ? " is one of your busiest days" : " is your busiest day"}`,
      detail: `${busiestWeekdayCount} scheduled tasks fall on ${DAY_NAMES[busiestWeekday]}s.`,
      tone: "neutral",
    };
  }

  const monthTasks = validTasks.filter((task) => {
    const date = readCalendarDate(task.date)!;
    return date.year === now.getFullYear() && date.month === now.getMonth() + 1;
  });

  if (monthTasks.length > 0) {
    const completedCount = monthTasks.filter((task) => task.completed).length;
    const completionPercentage = Math.round((completedCount / monthTasks.length) * 100);
    return {
      title: "Monthly progress",
      detail: `${completionPercentage}% of ${monthTasks.length} scheduled tasks this month are marked complete.`,
      tone: completedCount > 0 ? "positive" : "neutral",
    };
  }

  return fallbackInsight();
}
