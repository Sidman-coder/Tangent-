// Pipeline V2 (B4): adds tasks to a plan or project the student already has.
// One SMART call (feature "extendPlan") returns ONLY the new tasks given the
// existing ones (prompt: extend-plan-prompt.ts); placement goes through
// Juann's spacing brain (lib/spacing.ts spreadPlanDates, which reads
// lib/load.ts capacity and school blocks), so they fit around school and the
// student's usual load; the student context is his buildStudentContext. The
// result is a draft ChangeSet (target_plan_id, add_task ops with plan_id,
// update_plan on a rename, never create_plan) shown as a preview card headed
// "Updating ICF Prep · 6 tasks → 8 tasks". On confirm, apply adds them to the
// plan like addTasksToPlan does, with batch Undo.

import "server-only";
import type { NextResponse } from "next/server";
import { callClaude } from "../ai/call";
import { buildStudentContext } from "../ai/student-context";
import { extractStructuredJson } from "../anthropic-json";
import { inferCalendarGroup } from "../calendars";
import { spreadPlanDates } from "../spacing";
import { getAllTasks, getPlanById, getUserTimezone } from "../store";
import { localNow, promptDateContext } from "../time";
import { respondWithDraft } from "./drafting";
import { EXTEND_SYSTEM } from "./extend-plan-prompt";
import { applyPlacements, EXTEND_JSON_SCHEMA, extendHeader, extendOps, readExtendOutput, spacingNotes, targetDates } from "./extend-plan-core";

export type ExtendResult = { ok: true; response: NextResponse } | { ok: false; reason: "no_plan" | "call_failed" | "no_tasks"; message: string };

export async function extendPlan(planId: string, request: string, source: "typed" | "voice"): Promise<ExtendResult> {
  const plan = await getPlanById(planId);
  if (!plan) return { ok: false, reason: "no_plan", message: "I couldn't find that plan anymore." };
  const tz = await getUserTimezone();
  const today = localNow(tz).date;
  const existing = (await getAllTasks()).filter((t) => t.planId === planId).sort((a, b) => a.date.localeCompare(b.date));
  const picture = await buildStudentContext().catch(() => null);

  const listed = existing
    .slice(-40)
    .map((t) => `- ${t.completed ? "[done] " : ""}${t.title} (${t.date}${t.time ? ` ${t.time}` : ""})`)
    .join("\n");
  const user = [
    promptDateContext(tz),
    `PLAN: "${plan.title}"${plan.description ? `\nGOAL: ${plan.description.slice(0, 300)}` : ""}`,
    `ITS TASKS (${existing.length}):\n${listed || "none yet"}`,
    picture ? `STUDENT CONTEXT:\n${picture.text}` : "",
    `REQUEST:\n${request.slice(0, 1500)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const result = await callClaude(
    "extendPlan",
    { system: EXTEND_SYSTEM, messages: [{ role: "user", content: user }] },
    { format: { type: "json_schema", schema: EXTEND_JSON_SCHEMA } }
  );
  if (!result.ok) {
    console.warn("[extend-plan] model call failed:", result.status);
    return { ok: false, reason: "call_failed", message: result.budgetExceeded ? result.error : "Sorry, I couldn't add to that plan just now." };
  }
  let out;
  try {
    out = readExtendOutput(extractStructuredJson(result.message), existing.map((t) => t.title));
  } catch {
    return { ok: false, reason: "call_failed", message: "Sorry, I couldn't add to that plan just now." };
  }
  if (out.tasks.length === 0 && !out.new_title) return { ok: false, reason: "no_tasks", message: `I didn't find anything new to add to ${plan.title}.` };

  // Juann's spacing places every task the student didn't give a day and time.
  const open = existing.filter((t) => !t.completed && t.date >= today);
  const lastDate = open.length ? open[open.length - 1].date : null;
  const targets = targetDates(out.tasks, today, lastDate);
  const spaced = await spreadPlanDates(targets).catch((e) => {
    console.warn("[extend-plan] spacing failed, using target dates:", e instanceof Error ? e.message : e);
    return targets.map((date) => ({ date, time: "16:00" }));
  });
  const placed = applyPlacements(out.tasks, spaced);
  const calendarId = existing[0]?.calendarId ?? inferCalendarGroup(plan.title);

  const response = await respondWithDraft(
    {
      source,
      requestText: request,
      summary: "Add to plan",
      headline: extendHeader(plan.title, existing.length, placed.length),
      intent: out.tasks.length ? "add_to_plan" : "change_plan",
      targetPlanId: plan.id,
      ops: extendOps(plan.id, placed, out.new_title, calendarId),
      assumptions: spacingNotes(placed),
    },
    { text: request, today, route: "extend_plan" }
  );
  return { ok: true, response };
}
