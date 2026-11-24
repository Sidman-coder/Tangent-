// Overnight 2 (L10): replies said "Monday, 2026-11-23". A student reads
// "Monday, Nov 23". Plain code, so it holds even when the model forgets.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ISO_IN_PROSE = /\b((?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+(?:the\s+)?)?(20\d{2})-(\d{2})-(\d{2})\b/g;

/** "on Monday, 2026-11-23" → "on Monday, Nov 23"; a bare ISO date gets its weekday. */
export function humanizeDates(text: string): string {
  return text.replace(ISO_IN_PROSE, (whole, weekday: string | undefined, y: string, m: string, d: string) => {
    const month = Number(m);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return whole;
    const date = new Date(Date.UTC(Number(y), month - 1, day));
    if (date.getUTCDate() !== day) return whole;
    const name = weekday ? weekday.replace(/,?\s+(?:the\s+)?$/, "") : DAYS[date.getUTCDay()];
    return `${name}, ${MONTHS[month - 1]} ${day}`;
  });
}
