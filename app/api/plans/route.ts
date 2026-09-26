import { NextResponse } from "next/server";
import { getAllPlans, deletePlan, deleteTask, getAllTasks, getAppState } from "@/lib/store";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, plans: getAllPlans() });
});

export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as { action?: string; planId?: string; deleteTasks?: boolean };
    const { action, planId } = body;

    if (action === "delete") {
      if (!planId) return NextResponse.json({ ok: false, error: "Missing planId" }, { status: 400 });
      if (body.deleteTasks) {
        const tasks = getAllTasks().filter((t) => t.planId === planId);
        for (const t of tasks) deleteTask(t.id);
      }
      deletePlan(planId);
      return NextResponse.json({ ok: true, state: getAppState() });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
