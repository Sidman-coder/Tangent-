/** YYYY-MM-DD in local time */
export function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getMonthGrid(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1);
  const startPad = first.getDay(); // 0 Sun
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Date[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, monthIndex, -startPad + i + 1);
    cells.push(d);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, monthIndex, d));
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    cells.push(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1));
  }
  return cells;
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "14:05" -> "2:05 PM". Falls back to the raw input if it isn't HH:MM. */
export function formatTime12(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return t;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}
