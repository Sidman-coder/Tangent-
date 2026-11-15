// Round 5A 2.2: "Reading your week". One short line per day in the planning
// window, fed to the brief call so each step's "why" can point at a real day
// ("Tue is packed with soccer, so this one is short"). Pure.

export type WeekTask = { title: string; date: string; time?: string | null; completed?: boolean };

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function label(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAY[dt.getUTCDay()]} ${ymd}`;
}

/** "Mon 2026-11-16: soccer 4:00pm, essay draft (2 tasks)" or "… free". */
export function weekSummary(tasks: readonly WeekTask[], dates: readonly string[]): string {
  const byDate = new Map<string, WeekTask[]>();
  for (const t of tasks) {
    if (t.completed || !dates.includes(t.date)) continue;
    byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  }
  return dates
    .map((d) => {
      const list = byDate.get(d) ?? [];
      if (list.length === 0) return `${label(d)}: free`;
      const named = list.slice(0, 4).map((t) => (t.time ? `${t.title} ${t.time}` : t.title)).join(", ");
      return `${label(d)}: ${named}${list.length > 4 ? ` +${list.length - 4} more` : ""} (${list.length} task${list.length === 1 ? "" : "s"})`;
    })
    .join("\n");
}

/** Every date from start to end inclusive (YYYY-MM-DD), at most 31. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const [y, m, d] = start.split("-").map(Number);
  const cur = new Date(Date.UTC(y, m - 1, d));
  for (let i = 0; i < 31; i++) {
    const ymd = cur.toISOString().slice(0, 10);
    if (ymd > end) break;
    out.push(ymd);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
