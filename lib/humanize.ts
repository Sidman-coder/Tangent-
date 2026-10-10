// Model-written text (notifications, briefs) sometimes leaks raw timestamps:
// "due 2026-10-08 23:59", "at 2026-10-07 at 15:30", "at 14:00". Display runs
// it through here: dates become "Thu, Oct 8", times become 12-hour.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function time12(h: number, m: number): string {
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function humanizeTimestamps(text: string): string {
  return text
    .replace(/\b(\d{4})-(\d{2})-(\d{2})(?:(?:T|\s+at\s+|\s+)([01]?\d|2[0-3]):([0-5]\d)(?::\d{2})?)?\b/g, (_m, y, mo, d, h, mi) => {
      const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
      if (Number.isNaN(date.getTime())) return _m;
      const day = `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
      return h !== undefined ? `${day} · ${time12(Number(h), Number(mi))}` : day;
    })
    .replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*(?:am|pm|a\.m\.|p\.m\.))/gi, (_m, h, mi) => time12(Number(h), Number(mi)));
}
