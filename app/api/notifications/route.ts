import { NextResponse } from "next/server";
import { getNotifications, markNotificationRead, dismissNotification, dismissAllNotifications, getUnreadNotificationCount, claimNotificationPopups } from "@/lib/store";
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

    if (body.action === "claim_popups") {
      // Which of these have never popped? Claimed ids are now marked shown.
      // null = shown_at not migrated yet; the browser uses its own record.
      const claimed = await claimNotificationPopups(Array.isArray(body.ids) ? body.ids : []);
      return NextResponse.json({ ok: true, claimed });
    }

    if (body.action === "dismiss_all") {
      await dismissAllNotifications();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/notifications] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
