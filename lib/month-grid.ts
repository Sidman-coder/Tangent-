// Pure, timezone-safe calendar geometry for the month plan preview. Dates are
// YYYY-MM-DD strings; UTC is used only to count calendar days.

export type WeekStart = 0 | 1 | 6;
export type MonthGridItem = {
  key: string;
  date: string;
  kind: "new" | "existing";
  title: string;
  when: string;
  why?: string;
  label?: string;
  color?: string;
};
export type MonthCell = {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  newItems: MonthGridItem[];
  existing: MonthGridItem[];
  newOverflow: number;
  existingOverflow: number;
};

const utcDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};
function addDaysYMD(date: string, days: number): string {
  const value = utcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export const monthOf = (date: string) => `${date.slice(0, 7)}-01`;
export function shiftMonth(month: string, amount: number): string {
  const d = utcDate(month);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + amount, 1)).toISOString().slice(0, 10);
}
export function startOfPreviewWeek(date: string, weekStart: WeekStart): string {
  const delta = (utcDate(date).getUTCDay() - weekStart + 7) % 7;
  return addDaysYMD(date, -delta);
}

/** At most two new bars/dots and three existing dots per day. */
export function buildMonthGrid(monthStart: string, weekStart: WeekStart, items: MonthGridItem[], today?: string): MonthCell[][] {
  const month = monthOf(monthStart);
  const first = startOfPreviewWeek(month, weekStart);
  const last = addDaysYMD(shiftMonth(month, 1), -1);
  const end = addDaysYMD(startOfPreviewWeek(last, weekStart), 6);
  const byDate = new Map<string, { fresh: MonthGridItem[]; existing: MonthGridItem[] }>();
  for (const item of items) {
    const day = byDate.get(item.date) ?? { fresh: [], existing: [] };
    (item.kind === "new" ? day.fresh : day.existing).push(item);
    byDate.set(item.date, day);
  }
  const rows: MonthCell[][] = [];
  let date = first;
  while (date <= end) {
    const row: MonthCell[] = [];
    for (let i = 0; i < 7; i++) {
      const day = byDate.get(date);
      row.push({
        date,
        inMonth: monthOf(date) === month,
        isToday: date === today,
        newItems: day?.fresh.slice(0, 2) ?? [],
        existing: day?.existing.slice(0, 3) ?? [],
        newOverflow: Math.max(0, (day?.fresh.length ?? 0) - 2),
        existingOverflow: Math.max(0, (day?.existing.length ?? 0) - 3),
      });
      date = addDaysYMD(date, 1);
    }
    rows.push(row);
  }
  return rows;
}

export function previewRange(items: MonthGridItem[]): { first: string; last: string; minMonth: string; maxMonth: string } {
  const dates = items.filter((item) => item.kind === "new").map((item) => item.date).sort();
  const first = dates[0] ?? "";
  const last = dates.at(-1) ?? "";
  return { first, last, minMonth: first ? monthOf(first) : "", maxMonth: last ? monthOf(last) : "" };
}

const shortDate = (date: string) => utcDate(date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
export function weekLabel(weekStartDate: string): string {
  const end = addDaysYMD(weekStartDate, 6);
  const start = shortDate(weekStartDate);
  return `${start}–${monthOf(end) === monthOf(weekStartDate) ? utcDate(end).getUTCDate() : shortDate(end)}`;
}
