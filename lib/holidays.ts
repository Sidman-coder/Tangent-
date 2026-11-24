// Overnight 2 (L11): the rail answered "school ends at 3:00 PM" for
// Thanksgiving Day. The model now hears about US school holidays coming up.
// Plain rules, no data file. Local districts differ, so the line says "most".

// Own date math: lib/time.ts imports this file.
function addDaysYMD(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

type Holiday = { date: string; name: string };

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** The nth `weekday` (0 = Sunday) of a month; n = -1 is the last one. */
function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return ymd(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return ymd(y, m, lastDay - ((last - weekday + 7) % 7));
}

export function usSchoolHolidays(year: number): Holiday[] {
  const thanksgiving = nthWeekday(year, 11, 4, 4);
  return [
    { date: ymd(year, 1, 1), name: "New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3), name: "Martin Luther King Jr. Day" },
    { date: nthWeekday(year, 2, 1, 3), name: "Presidents' Day" },
    { date: nthWeekday(year, 5, 1, -1), name: "Memorial Day" },
    { date: ymd(year, 7, 4), name: "Independence Day" },
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day" },
    { date: thanksgiving, name: "Thanksgiving" },
    { date: addDaysYMD(thanksgiving, 1), name: "the day after Thanksgiving" },
    { date: ymd(year, 12, 25), name: "Christmas Day" },
  ];
}

/** Holidays from `today` through `days` ahead, in order. */
export function upcomingHolidays(today: string, days = 14): Holiday[] {
  const end = addDaysYMD(today, days);
  const y = Number(today.slice(0, 4));
  return [...usSchoolHolidays(y), ...usSchoolHolidays(y + 1)].filter((h) => h.date >= today && h.date <= end);
}

/** One sentence for the prompt, or "" when nothing is coming up. */
export function holidayLine(today: string): string {
  const list = upcomingHolidays(today);
  if (!list.length) return "";
  return ` Coming up: ${list.map((h) => `${h.date} is ${h.name}`).join("; ")}. Most US schools are closed then, so don't assume school hours on those days.`;
}
