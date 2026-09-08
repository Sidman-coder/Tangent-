// lib/calendar.ts
//
// READ-ONLY BY DESIGN. This module only ever calls Google Calendar endpoints
// capable of reading calendar data (calendarList.list / events.list) using the
// calendar.readonly OAuth scope. It must never implement events.insert,
// events.update, events.patch, events.delete, calendars.insert, or any
// endpoint that can create, modify, or delete calendars or events.
// Do not add write-capable functions to this file.

export type Calendar = {
  id: string;
  name: string;
  primary: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  description: string;
  location: string;
  attendees: string[];
  calendarId: string;
  calendarName: string;
};

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

/** Refreshes the access token using the stored refresh token. Requires a refresh token granted with the calendar.readonly scope only. */
async function getCalendarAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedTokenExpiresAt) {
    return cachedAccessToken;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN in .env.local"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar token refresh failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = data.access_token;
  // Refresh a little early to avoid using a token that expires mid-request.
  cachedTokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedAccessToken;
}

type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
};

type GoogleCalendarEventResource = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string }[];
};

function eventToCalendarEvent(
  ev: GoogleCalendarEventResource,
  calendarId: string,
  calendarName: string
): CalendarEvent {
  return {
    id: ev.id,
    title: ev.summary ?? "(no title)",
    start: ev.start?.dateTime ?? ev.start?.date ?? "",
    end: ev.end?.dateTime ?? ev.end?.date ?? "",
    description: ev.description ?? "",
    location: ev.location ?? "",
    attendees: (ev.attendees ?? []).map((a) => a.displayName || a.email),
    calendarId,
    calendarName,
  };
}

/** Lists events on one calendar within a time range. GET-only. Skips calendars the token can't read events for. */
async function listEventsForCalendar(
  accessToken: string,
  calendar: Calendar,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const res = await fetch(
    `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendar.id)}/events?${params.toString()}`,
    { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return [];

  const data = (await res.json()) as { items?: GoogleCalendarEventResource[] };
  return (data.items ?? []).map((ev) => eventToCalendarEvent(ev, calendar.id, calendar.name));
}

/** Fetches the list of calendars the user has access to. GET-only. */
export async function getUserCalendars(): Promise<Calendar[]> {
  const accessToken = await getCalendarAccessToken();

  const res = await fetch(`${CALENDAR_API_BASE}/users/me/calendarList`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar list failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { items?: GoogleCalendarListEntry[] };
  return (data.items ?? []).map((c) => ({
    id: c.id,
    name: c.summary ?? c.id,
    primary: c.primary === true,
  }));
}

/** Fetches upcoming events across all of the user's calendars for the next X days. GET-only. */
export async function getUpcomingEvents(daysAhead: number): Promise<CalendarEvent[]> {
  const accessToken = await getCalendarAccessToken();
  const calendars = await getUserCalendars();

  const now = new Date();
  const timeMin = now.toISOString();
  const rangeDays = Math.max(1, daysAhead || 7);
  const timeMax = new Date(now.getTime() + rangeDays * 24 * 60 * 60 * 1000).toISOString();

  const events: CalendarEvent[] = [];
  for (const calendar of calendars) {
    const calEvents = await listEventsForCalendar(accessToken, calendar, timeMin, timeMax);
    events.push(...calEvents);
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}

/** Fetches events across all of the user's calendars for a specific date (YYYY-MM-DD). GET-only. */
export async function getEventsForDate(date: string): Promise<CalendarEvent[]> {
  const accessToken = await getCalendarAccessToken();
  const calendars = await getUserCalendars();

  const timeMin = new Date(`${date}T00:00:00`).toISOString();
  const timeMax = new Date(`${date}T23:59:59`).toISOString();

  const events: CalendarEvent[] = [];
  for (const calendar of calendars) {
    const calEvents = await listEventsForCalendar(accessToken, calendar, timeMin, timeMax);
    events.push(...calEvents);
  }

  events.sort((a, b) => a.start.localeCompare(b.start));
  return events;
}
