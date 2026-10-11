// Reading a calendar file (.ics) - what Google Calendar, Apple Calendar and
// Outlook all export - into plain events Tangent can add as tasks. Runs in
// the browser (components/settings/CalendarImport.tsx); pure, so it's tested
// on its own (lib/ics.test.ts).
//
// Handles what real exports contain: folded lines, all-day and timed events,
// UTC ("Z") and floating/TZID times (read as local wall time), escaped text,
// and simple repeats (FREQ=DAILY/WEEKLY with INTERVAL, BYDAY, COUNT, UNTIL)
// expanded inside the import window.

export type IcsEvent = {
  title: string;
  /** YYYY-MM-DD, local. */
  date: string;
  /** HH:MM, local; all-day events have allDay set. */
  time: string;
  allDay: boolean;
  location?: string;
};

type Raw = Record<string, { value: string; params: string }>;

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function unescape(text: string): string {
  return text.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
}

/** A DTSTART/UNTIL value as a local Date, plus whether it was a date only. */
export function parseIcsDate(value: string, params = ""): { at: Date; allDay: boolean } | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly || /VALUE=DATE(?!-)/i.test(params)) {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!m) return null;
    return { at: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const at = z
    ? new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0)))
    : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  return { at, allDay: false };
}

function blocks(text: string): Raw[] {
  // Unfold: a line starting with a space or tab continues the previous one.
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: Raw[] = [];
  let cur: Raw | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) cur = {};
    else if (/^END:VEVENT/i.test(line)) {
      if (cur) out.push(cur);
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const head = line.slice(0, i);
      const [name, ...params] = head.split(";");
      cur[name.toUpperCase()] = { value: line.slice(i + 1), params: params.join(";") };
    }
  }
  return out;
}

function rule(rrule: string): Record<string, string> {
  return Object.fromEntries(
    rrule.split(";").map((part) => {
      const [k, v] = part.split("=");
      return [k.toUpperCase(), (v ?? "").toUpperCase()];
    })
  );
}

/** Events between `from` and `to` (inclusive, YYYY-MM-DD), soonest first. */
export function parseIcs(text: string, from: string, to: string, limit = 200): IcsEvent[] {
  const events: IcsEvent[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td, 23, 59, 59);

  for (const raw of blocks(text)) {
    if (/CANCELLED/i.test(raw.STATUS?.value ?? "")) continue;
    const title = unescape(raw.SUMMARY?.value ?? "");
    const dt = raw.DTSTART ? parseIcsDate(raw.DTSTART.value, raw.DTSTART.params) : null;
    if (!title || !dt) continue;
    const location = raw.LOCATION ? unescape(raw.LOCATION.value) || undefined : undefined;
    const push = (at: Date) => {
      if (at < start || at > end) return;
      events.push({ title, date: ymd(at), time: dt.allDay ? "09:00" : `${pad(at.getHours())}:${pad(at.getMinutes())}`, allDay: dt.allDay, location });
    };

    const rr = raw.RRULE ? rule(raw.RRULE.value) : null;
    if (!rr || !/^(DAILY|WEEKLY)$/.test(rr.FREQ ?? "")) {
      push(dt.at);
      continue;
    }
    const interval = Math.max(1, Number(rr.INTERVAL) || 1);
    const until = rr.UNTIL ? parseIcsDate(rr.UNTIL)?.at ?? end : end;
    const stop = until < end ? until : end;
    const count = rr.COUNT ? Number(rr.COUNT) : Infinity;
    const byDay = rr.BYDAY ? rr.BYDAY.split(",").map((c) => DAY_CODES.indexOf(c.slice(-2))).filter((n) => n >= 0) : [];
    let made = 0;
    for (let day = new Date(dt.at); day <= stop && made < count; day.setDate(day.getDate() + 1)) {
      const daysIn = Math.round((new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() - new Date(dt.at.getFullYear(), dt.at.getMonth(), dt.at.getDate()).getTime()) / 86_400_000);
      let hit: boolean;
      if (rr.FREQ === "DAILY") hit = daysIn % interval === 0;
      else {
        const week = Math.floor(daysIn / 7);
        const weekday = byDay.length ? byDay : [dt.at.getDay()];
        hit = week % interval === 0 && weekday.includes(day.getDay());
      }
      if (!hit) continue;
      made++;
      push(new Date(day));
    }
  }

  events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return events.slice(0, limit);
}
