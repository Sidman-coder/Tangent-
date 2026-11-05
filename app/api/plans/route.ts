import { NextResponse } from "next/server";
import { getAllPlans, deletePlan, deleteTask, getAllTasks, getAppState, recordAction, updatePlan } from "@/lib/store";
import { SERIES_KEYS, type SeriesKey } from "@/lib/task-colors";
import { withUser } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, plans: await getAllPlans() });
});

export const POST = withUser(async (req: Request) => {
  try {
    const body = (await req.json()) as {
      action?: string;
      planId?: string;
      deleteTasks?: boolean;
      title?: string;
      description?: string;
      color?: string;
    };
    const { action, planId } = body;

    if (action === "delete") {
      if (!planId) return NextResponse.json({ ok: false, error: "Missing planId" }, { status: 400 });
      if (body.deleteTasks) {
        const tasks = (await getAllTasks()).filter((t) => t.planId === planId);
        for (const t of tasks) await deleteTask(t.id);
      }
      await deletePlan(planId);
      return NextResponse.json({ ok: true, state: await getAppState() });
    }

    // Projects page: rename a project or change its goal.
    if (action === "update") {
      if (!planId) return NextResponse.json({ ok: false, error: "Missing planId" }, { status: 400 });
      const plan = await updatePlan(planId, { title: body.title, description: body.description });
      if (!plan) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
      return NextResponse.json({ ok: true, plan });
    }

    // Project page: palette swatches only.
    if (action === "set_color") {
      if (!planId) return NextResponse.json({ ok: false, error: "Missing planId" }, { status: 400 });
      if (!SERIES_KEYS.includes(body.color as SeriesKey)) {
        return NextResponse.json({ ok: false, error: "Pick a color from the palette" }, { status: 400 });
      }
      const before = (await getAllPlans()).find((p) => p.id === planId);
      if (!before) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
      const plan = await updatePlan(planId, { color: body.color });
      if (!plan) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 });
      const record = await recordAction("reschedule_task", `Changed the color of "${plan.title}"`, {
        planColor: { planId, from: before.color },
      });
      return NextResponse.json({ ok: true, plan, actionId: record.id });
    }

    return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
