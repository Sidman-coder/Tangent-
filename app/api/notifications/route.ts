import { NextResponse } from "next/server";
import { getNotifications, markNotificationRead, dismissNotification, getUnreadNotificationCount } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () => {
  return NextResponse.json({
    notifications: await getNotifications(),
    unreadCount: await getUnreadNotificationCount(),
  });
});

export const POST = withUser(async (request: Request) => {
  try {
    const body = await request.json();

    if (body.action === "mark_read") {
      await markNotificationRead(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "dismiss") {
      await dismissNotification(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "dismiss_all") {
      for (const n of await getNotifications()) await dismissNotification(n.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/notifications] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
