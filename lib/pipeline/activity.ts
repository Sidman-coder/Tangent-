import "server-only";

// Settings › AI Activity (step 3B): the handlers behind /api/ai-activity.
// Every read and delete runs as the signed-in student (session client: RLS
// plus a user_id filter in lib/store.ts). With TANGENT_PIPELINE_V2 off they
// answer 404. Owner-only fields (models, tokens, estimated cost from
// ai_usage) are added only for isOwnerEmail. Clearing deletes ai_decisions
// rows and nothing else: the calendar stays the same.

import { currentUserIsOwner } from "../request-context";
import {
  clearDecisions,
  deleteDecision,
  getActionsByIds,
  getAllPlans,
  getAllTasks,
  getChangeSetsByIds,
  getSkippedDuplicates,
  getUsageBetween,
  listDecisions,
  type DecisionRecord,
} from "../store";
import {
  ACTIVITY_DAYS,
  ACTIVITY_PAGE_SIZE,
  answerText,
  attachUsage,
  filterActivity,
  isActivityId,
  likePattern,
  matchStrength,
  paginate,
  parseActivityQuery,
  questionText,
  resultOf,
  understoodAs,
  whoDecided,
  type ActivityResponse,
  type ActivityRow,
  type UsageTotals,
} from "../ai-activity";
import { describeChangeSet, type ChangeSet } from "./changeset";
import { logEvent } from "./events";
import { TANGENT_PIPELINE_V2 } from "./flags";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const notFound = () => json({ ok: false, message: "Not found" }, 404);
const DAY_MS = 86_400_000;

/** GET /api/ai-activity: one page of the student's activity, newest first. */
export async function activityGet(req: Request): Promise<Response> {
  if (!TANGENT_PIPELINE_V2) return notFound();
  try {
    const url = new URL(req.url);
    // Recent changes asks which undo entries came from Tangent AI, to show Details.
    if (url.searchParams.get("only") === "action_ids") {
      const since = new Date(Date.now() - ACTIVITY_DAYS[ACTIVITY_DAYS.length - 1] * DAY_MS).toISOString();
      const actionIds = (await listDecisions(since)).flatMap((r) => (r.actionId ? [r.actionId] : []));
      return json({ ok: true, actionIds });
    }
    const query = parseActivityQuery(url.searchParams);
    // Details links name a row; find it in the full 90 days, without filters.
    const focusing = query.focus !== null;
    const days = focusing ? ACTIVITY_DAYS[ACTIVITY_DAYS.length - 1] : query.days;
    const since = new Date(Date.now() - days * DAY_MS).toISOString();
    const all = await listDecisions(since, !focusing && query.q ? likePattern(query.q) : undefined);
    const rows = focusing ? all : filterActivity(all, query);

    let page = query.page;
    let focusId: string | null = null;
    if (query.focus) {
      const { by, id } = query.focus;
      const i = rows.findIndex((r) => (by === "id" ? r.id : by === "cs" ? r.changeSetId : r.actionId) === id);
      if (i >= 0) {
        focusId = rows[i].id;
        page = Math.floor(i / ACTIVITY_PAGE_SIZE) + 1;
      }
    }
    const slice = paginate(rows, page);
    const owner = currentUserIsOwner();
    const out: ActivityResponse = {
      ok: true,
      rows: await explain(slice.items, owner),
      page: slice.page,
      pages: slice.pages,
      total: rows.length,
      owner,
      focusId,
    };
    // A first look, not every page turn or filter change.
    if (url.searchParams.get("view") === "1") logEvent("activity_viewed", { rows: rows.length, owner, focus: focusing });
    if (query.focus && focusId) logEvent("activity_row_expanded", { from: "details_link" });
    return json(out);
  } catch (e) {
    console.error("[ai-activity] list:", e instanceof Error ? e.message : e);
    return json({ ok: false, message: "Couldn't load AI activity." }, 500);
  }
}

/** POST /api/ai-activity { expanded: id }: a row was opened (event only). */
export async function activityPost(req: Request): Promise<Response> {
  if (!TANGENT_PIPELINE_V2) return notFound();
  const body = (await req.json().catch(() => null)) as { expanded?: unknown } | null;
  if (!isActivityId(body?.expanded)) return json({ ok: false, message: "Missing id" }, 400);
  logEvent("activity_row_expanded", { from: "table" });
  return json({ ok: true });
}

/** DELETE /api/ai-activity: clears the student's log. The calendar stays the same. */
export async function activityClear(): Promise<Response> {
  if (!TANGENT_PIPELINE_V2) return notFound();
  try {
    const removed = await clearDecisions();
    logEvent("activity_cleared", { rows: removed, scope: "all" });
    return json({ ok: true, removed });
  } catch (e) {
    console.error("[ai-activity] clear:", e instanceof Error ? e.message : e);
    return json({ ok: false, message: "Couldn't clear AI activity." }, 500);
  }
}

/** DELETE /api/ai-activity/[id]: removes one row of the student's log. */
export async function activityDelete(req: Request): Promise<Response> {
  if (!TANGENT_PIPELINE_V2) return notFound();
  const id = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  if (!isActivityId(id)) return json({ ok: false, message: "Not found" }, 404);
  try {
    if (!(await deleteDecision(id))) return json({ ok: false, message: "Not found" }, 404);
    logEvent("activity_cleared", { rows: 1, scope: "row" });
    return json({ ok: true });
  } catch (e) {
    console.error("[ai-activity] delete:", e instanceof Error ? e.message : e);
    return json({ ok: false, message: "Couldn't delete that row." }, 500);
  }
}

/** Turns a page of decision rows into what the table shows, with titles read
 *  now (rows store ids only). */
async function explain(rows: DecisionRecord[], owner: boolean): Promise<ActivityRow[]> {
  if (rows.length === 0) return [];
  const csIds = rows.flatMap((r) => (r.changeSetId ? [r.changeSetId] : []));
  const actionIds = rows.flatMap((r) => (r.actionId ? [r.actionId] : []));
  const [plans, changeSets, actions, skipped, tasks] = await Promise.all([
    getAllPlans().catch(() => []),
    getChangeSetsByIds(csIds).catch(() => [] as ChangeSet[]),
    getActionsByIds(actionIds).catch(() => []),
    getSkippedDuplicates(csIds),
    getAllTasks().catch(() => []),
  ]);
  const planTitle = (id: string | null | undefined) => (id ? plans.find((p) => p.id === id)?.title ?? null : null);
  const known = { plans: plans.map((p) => ({ id: p.id, title: p.title })), tasks: tasks.map((t) => ({ id: t.id, title: t.title })) };

  let usage = new Map<string, UsageTotals>();
  if (owner) {
    const times = rows.map((r) => Date.parse(r.createdAt));
    const lines = await getUsageBetween(new Date(Math.min(...times) - 180_000).toISOString(), new Date(Math.max(...times) + 5_000).toISOString());
    usage = attachUsage(rows, lines);
  }

  return rows.map((r) => {
    const cs = r.changeSetId ? changeSets.find((c) => c.id === r.changeSetId) : undefined;
    const action = r.actionId ? actions.find((a) => a.id === r.actionId) : undefined;
    const created = cs?.ops.find((o) => o.op === "create_plan");
    const chosen = planTitle(r.chosenPlanId) ?? planTitle(cs?.target_plan_id);
    const candidates = (r.planMatch?.candidates ?? []).map((c) => ({
      title: planTitle(c.id) ?? "A plan you've since removed",
      score: c.score,
      strength: matchStrength(c.score),
    }));
    const chosenHow = r.chosenPlanId
      ? r.pendingQuestion
        ? "You picked it when Tangent asked."
        : r.planMatch?.decision === "sure"
          ? "A strong match, so Tangent used it without asking."
          : "Tangent chose it."
      : null;
    const question = questionText(r.pendingQuestion);
    const row: ActivityRow = {
      id: r.id,
      createdAt: r.createdAt,
      source: r.source,
      request: r.requestText,
      type: understoodAs(r),
      confidence: r.confidence,
      plan: created && created.op === "create_plan" ? created.title : chosen,
      changes: cs?.ops.length ?? 0,
      result: resultOf(r),
      why: {
        intent: r.intent,
        whoDecided: whoDecided(r.via),
        candidates,
        chosen,
        chosenHow,
        question,
        answer: question ? answerText(r.outcome, planTitle(r.chosenPlanId)) : null,
        assumptions: cs?.assumptions ?? [],
        changes: cs ? describeChangeSet(cs, known) : [],
        skippedDuplicates: (r.changeSetId && skipped.get(r.changeSetId)) || 0,
        undo: action && action.undoable && !action.undone ? { actionId: action.id, label: action.summary } : null,
        draftOpen: r.outcome === "drafted" && cs?.status === "draft",
      },
    };
    if (owner) row.usage = usage.get(r.id) ?? { models: r.models, inputTokens: 0, outputTokens: 0, costUsd: 0 };
    return row;
  });
}
