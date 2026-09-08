import { NextResponse } from "next/server";
import { getNotifications, markNotificationRead, dismissNotification, getUnreadNotificationCount } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    notifications: getNotifications(),
    unreadCount: getUnreadNotificationCount(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === "mark_read") {
      markNotificationRead(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "dismiss") {
      dismissNotification(body.id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "dismiss_all") {
      getNotifications().forEach((n) => dismissNotification(n.id));
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/notifications] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
