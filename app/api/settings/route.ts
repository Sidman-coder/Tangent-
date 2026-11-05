import { NextResponse } from "next/server";
import { getNotificationPrefs, getUserTimezone, replaceSchoolBlock, setNotificationPrefs, setWeekStart } from "@/lib/store";
import { withUser } from "@/lib/request-context";
import { parseSchoolHours } from "@/lib/onboarding";
import { parseNotificationPrefs } from "@/lib/settings/notification-prefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: the Settings values that aren't part of app state yet. */
export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, notificationPrefs: await getNotificationPrefs() });
});

const NOT_APPLIED = "Can't save this yet — the database update for it hasn't been applied.";

/** PATCH one or more of { weekStart, notificationPrefs, schoolHours }.
 *  schoolHours: null clears the School block; otherwise it replaces it. */
export const PATCH = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  const unknownKey = Object.keys(body).find((k) => !["weekStart", "notificationPrefs", "schoolHours"].includes(k));
  if (unknownKey) return NextResponse.json({ ok: false, error: `Unknown field ${unknownKey}` }, { status: 400 });

  if ("weekStart" in body) {
    const day = body.weekStart;
    if (day !== 0 && day !== 1 && day !== 6) return NextResponse.json({ ok: false, error: "weekStart must be 0, 1 or 6" }, { status: 400 });
    if (!(await setWeekStart(day))) return NextResponse.json({ ok: false, error: NOT_APPLIED }, { status: 503 });
  }
  if ("notificationPrefs" in body) {
    if (!(await setNotificationPrefs(parseNotificationPrefs(body.notificationPrefs)))) {
      return NextResponse.json({ ok: false, error: NOT_APPLIED }, { status: 503 });
    }
  }
  if ("schoolHours" in body) {
    const hours = body.schoolHours === null ? null : parseSchoolHours(body.schoolHours);
    if (body.schoolHours !== null && !hours) return NextResponse.json({ ok: false, error: "Pick at least one day and an end after the start" }, { status: 400 });
    await replaceSchoolBlock(hours, await getUserTimezone());
  }
  return NextResponse.json({ ok: true });
});
