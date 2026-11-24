import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { trackEvent } from "@/lib/analytics";
import { DISTRESS_REPLY, isSensitive, looksDistressed } from "@/lib/student/sensitive";
import { reportFeel, reportedStep } from "@/lib/progress-report";
import { calendarReply, lastUserMessage, pendingAnswerReply, planReply, talkReply, type CalendarReplyOptions } from "@/lib/chat-reply";
import { parsePendingQuestion, PENDING_QUESTION_ID } from "@/lib/pending-question";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";
import { handleRequest } from "@/lib/pipeline/intake";
import { routeAnswerReply } from "@/lib/pipeline/understand";
import { type HomeKind } from "@/lib/pipeline/home-route";
import { planRequestText, routeMessage, type TalkScope } from "@/lib/pipeline/talk-route";
import { extendPlan } from "@/lib/pipeline/extend-plan";
import { addPendingConfirmation, addTask, addVoiceLog, completeTask, countChatSessions, getAllPlans, getAllTasks, getUserTimezone, recordAction, setCapacity, updateTask } from "@/lib/store";
import { proposeBulk } from "@/lib/pipeline/bulk-action-run";
import { isDatedExam, quickCapture, splitCaptureItems, type QuickCapture } from "@/lib/ai/router";
import { inferCalendarGroup } from "@/lib/calendars";
import { dayName } from "@/lib/load";
import { formatTime12 } from "@/lib/dates";
import { CAPACITY_QUESTION, PROJECT_QUESTION_PREFIX, PROJECT_YES, capacityFromAnswer, clarifyQuestions, shouldConsiderClarifying } from "@/lib/ai/clarify";
import { buildStudentContext } from "@/lib/ai/student-context";
import { grillTurn, parseSlotTurn } from "@/lib/context/grill";
import { matchProject } from "@/lib/project-match";
import { placeNewTask, reliefSuggestion } from "@/lib/spacing";
import { addDaysYMD, localNow } from "@/lib/time";
import { cleanTitle } from "@/lib/quick-add";
import { projectContext, taskContext } from "@/lib/chat/server";
import { getChatSession } from "@/lib/store";
import { logStepEvent, logStepEvents } from "@/lib/student/step-events";
import { classifyAsk, toCode } from "@/lib/student/observations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Calendar mode runs a multi-turn Claude tool loop; measured at ~48s in
// production. With no maxDuration declared, the platform default killed it
// partway through and the console blamed a missing API key.
export const maxDuration = 60;

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
type ChatMode = "plan" | "calendar";

// The task and project notes live in lib/chat/server.ts (budgeted, with the
// thread's running summary).
const projectBrief = (projectId: string, summary?: string | null) => projectContext(projectId, summary);
const findTaskBrief = (taskId: string, summary?: string | null) => taskContext(taskId, summary);

/** Overnight 2 (Jordan sim): "drafted the club pitch, went fine" logs how
 *  that step went, like the check-in sheet (app/api/today "check_in"), and
 *  marks it done if it wasn't. Null when no recent step matches. No model. */
async function logProgressReport(text: string): Promise<Record<string, unknown> | null> {
  const today = localNow(await getUserTimezone()).date;
  const step = reportedStep(await getAllTasks(), text, today);
  if (!step) return null;
  let actionId: string | undefined;
  if (!step.completed) {
    await completeTask(step.id);
    actionId = (await recordAction("complete_task", `Completed "${step.title}"`, { completedTaskId: step.id })).id;
  }
  const feel = reportFeel(text);
  if (feel) logStepEvents([{ kind: "check_in", task: step, code: feel }]);
  const said = text.replace(/\s+/g, " ").trim().slice(0, 280);
  // Teen privacy: health, family or distress never get written down.
  if (said && !looksDistressed(said) && !isSensitive(said)) {
    const kept = (step.notes ?? "").replace(/(?:^|\n)\s*HOW IT WENT:[^\n]*/gi, "").trim();
    await updateTask(step.id, { notes: [kept, `HOW IT WENT: ${said}`].filter(Boolean).join("\n") }).catch(() => null);
  }
  trackEvent("step_check_in", { task_id: step.id, count: feel ? 1 : 0 });
  const message = `Logged how “${step.title}” went${actionId ? ", and marked it done" : ""}. Thanks for telling me. It helps size the next steps.`;
  return { ok: true, action: "chat_reply", message, ...(actionId ? { actionId } : {}) };
}

/** Saves a quick capture: spacing brain for the when, no model. */
async function saveQuickCapture(quick: QuickCapture): Promise<Record<string, unknown>> {
  const placed = await placeNewTask({ date: quick.date ?? null, time: quick.time ?? null, deadline: quick.deadline ?? null });
  const task = await addTask({
    // Same lead-in cleanup as every other single add ("I have a ..." → "...").
    title: cleanTitle(quick.title),
    date: placed.date,
    time: placed.time,
    completed: false,
    calendarId: inferCalendarGroup(quick.title),
  });
  if (task.wasDuplicate) {
    return { ok: true, action: "add_task", message: `Already have "${task.title}" around then.` };
  }
  const record = await recordAction("add_task", `Added "${task.title}"`, { addedTaskIds: [task.id] });
  trackEvent("capture", { task_id: task.id, source: "quick" });
  const tz = await getUserTimezone();
  const today = localNow(tz).date;
  const day =
    task.date === today ? "today" : task.date === addDaysYMD(today, 1) ? "tomorrow" : `${dayName(task.date)}`;
  // An exam with no day said: the day is only a placeholder (overnight 2, Maya sim).
  const placeholder = !quick.date && !quick.deadline && isDatedExam(task.title);
  return {
    ok: true,
    action: "add_task",
    message: placeholder
      ? `Added ${task.title} to ${day} for now. When is it? Open it and tell me the date, and I'll move it and plan study time before it.`
      : `Added ${task.title} for ${day} at ${formatTime12(task.time)}.${placed.note ? ` ${placed.note}` : ""}`,
    actionId: record.id,
    taskId: task.id,
    taskDate: task.date,
    quick: true,
    suggestion: await reliefSuggestion(),
  };
}

/** Two or more dated to-dos typed in one line: each is saved with the day it was typed with (overnight C09). */
async function saveQuickCaptures(items: QuickCapture[]): Promise<Record<string, unknown>> {
  const saved: { id: string; title: string; date: string; time: string; due: string | null }[] = [];
  let skipped = 0;
  for (const quick of items) {
    const placed = await placeNewTask({ date: quick.date ?? null, time: quick.time ?? null, deadline: quick.deadline ?? null });
    // "math hw due Thu" is worked on before Thursday; keep the due day on it
    // so the detail doesn't say "for tomorrow" (overnight 2, live L4).
    const due = !quick.date && quick.deadline ? quick.deadline : null;
    const task = await addTask({
      title: cleanTitle(quick.title),
      // The day the student typed stands; only the time is chosen for them.
      date: quick.date ?? placed.date,
      time: placed.time,
      completed: false,
      calendarId: inferCalendarGroup(quick.title),
      ...(due ? { notes: `DUE: ${dayName(due)} ${due}` } : {}),
    });
    if (task.wasDuplicate) skipped++;
    else saved.push({ id: task.id, title: task.title, date: task.date, time: task.time, due });
  }
  if (saved.length === 0) return { ok: true, action: "add_task", message: "Those are already on your calendar." };
  const record = await recordAction("add_task", `Added ${saved.length} to-dos`, { addedTaskIds: saved.map((t) => t.id) });
  trackEvent("capture", { count: saved.length, source: "quick_multi" });
  const list = saved
    .map((t) => `${t.title} (${dayName(t.date)}${t.due && t.due !== t.date ? `, due ${dayName(t.due)}` : ""})`)
    .join(", ");
  return {
    ok: true,
    action: "add_task",
    message: `Found ${saved.length} things and added them: ${list}.${skipped ? ` ${skipped} already on your calendar.` : ""}`,
    actionId: record.id,
    taskId: saved[0].id,
    taskDate: saved[0].date,
    quick: true,
  };
}

type Answer = { id: string; question: string; answer: string };

function parseAnswers(raw: unknown): Answer[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a): a is Answer =>
      !!a && typeof a === "object" &&
      typeof (a as Answer).id === "string" &&
      typeof (a as Answer).question === "string" &&
      typeof (a as Answer).answer === "string" &&
      (a as Answer).answer.trim().length > 0
    )
    .slice(0, 4)
    .map((a) => ({ id: a.id, question: a.question.slice(0, 200), answer: a.answer.trim().slice(0, 300) }));
}

export const POST = withUser(async (req: Request) => {
  try {
    console.log("[api/chat] === CHAT REQUEST START ===");
    const body = (await req.json()) as {
      messages?: unknown;
      mode?: unknown;
      stream?: unknown;
      /** Opt in to "grill me" questions (the AI page does; capture never does). */
      clarify?: unknown;
      /** Answers to questions from a previous clarify reply. */
      answers?: unknown;
      /** From the capture mic or Cmd-K: a plain to-do saves without a model. */
      capture?: unknown;
      /** Asked from inside a Project: its steps join it. */
      projectId?: unknown;
      taskId?: unknown;
      /** The chat thread this message belongs to; its running summary joins the note. */
      sessionId?: unknown;
      /** "New project" on the Projects page: always builds a plan. */
      newProject?: unknown;
      /** Pipeline V2: "chat" is the "Just talking, don't add" re-ask. */
      route?: unknown;
      /** A question Tangent is waiting on ("Which one should I delete?"),
       *  sent back with the next message (lib/pending-question.ts). */
      pendingQuestion?: unknown;
      /** Pipeline V2: "voice" when the text was dictated in the browser. */
      source?: unknown;
      /** "Grill until enough" (lib/context): one question at a time. AddFlow opts in. */
      slotFlow?: unknown;
      /** The slot flow so far, sent back each turn (lib/context/grill.ts SlotTurn). */
      slotTurn?: unknown;
      /** Round 4 §3.3: "Just talk" in the planning workspace. A reply only; nothing is added. */
      talk?: unknown;
      /** Round 4 Phase 4: typed into Home's box (or a project's ask box).
       *  Routed first (lib/pipeline/home-route.ts): answered, extended,
       *  grilled, planned or added — never grilled about what's known. */
      home?: unknown;
      /** Round 5A 2.1: "Plan this into my calendar" (or the answer to the plan's one question). */
      planThis?: unknown;
      /** The message the "Plan this" row sat under. */
      planGoal?: unknown;
      /** { question, answer }: the reply to the plan brief's one question. */
      planAnswer?: unknown;
      /** Where it was typed (home, capture, task, project, rail, palette). Logged only. */
      scope?: unknown;
    };
    const mode: ChatMode = body.mode === "plan" ? "plan" : "calendar";
    const raw = body.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json({ ok: false, error: "Missing messages array" }, { status: 400 });
    }

    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of raw) {
      if (!m || typeof m !== "object") continue;
      const role = (m as { role?: string }).role;
      const content = (m as { content?: string }).content;
      if ((role === "user" || role === "assistant") && typeof content === "string" && content.trim()) {
        messages.push({ role, content: content.trim() });
      }
    }

    if (messages.length === 0) {
      return NextResponse.json({ ok: false, error: "No valid messages" }, { status: 400 });
    }

    const userText = lastUserMessage(messages);
    if (!userText) {
      return NextResponse.json({ ok: false, error: "No user message" }, { status: 400 });
    }

    // Real distress is never turned into a task or remembered: a kind reply
    // that points to a trusted adult and 988 (lib/student/sensitive.ts).
    if (looksDistressed(userText)) {
      const reply = { ok: true, action: null, message: DISTRESS_REPLY, response: DISTRESS_REPLY, care: true };
      if (body.stream !== true) return NextResponse.json(reply);
      return new Response(JSON.stringify({ type: "result", ...reply }) + "\n", {
        headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Tangent's AI isn't set up on the server yet, so it can't answer right now." }, { status: 503 });
    }

    let projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : "";
    const threadSummary =
      typeof body.sessionId === "string" && body.sessionId
        ? ((await getChatSession(body.sessionId).catch(() => null))?.summary ?? null)
        : null;
    const aboutTask = typeof body.taskId === "string" && body.taskId ? await findTaskBrief(body.taskId, threadSummary) : null;
    if (aboutTask?.planId && !projectId) projectId = aboutTask.planId;
    // What kind of help they ask a task chat for (a code, never the words).
    if (aboutTask && typeof body.taskId === "string") logStepEvent({ kind: "chat_ask", task: { id: body.taskId, planId: aboutTask.planId ?? "", notes: "", date: "", time: "" }, code: classifyAsk(userText) });

    // An answer to a pending question (A1), flag on and off: resolved before
    // any other routing, so it never becomes a plan or hits a fast path. A
    // tapped button arrives as the card's answer; a typed reply as the text.
    // A new request instead of an answer drops the question and goes on below.
    const source = body.source === "voice" ? "voice" : "typed";
    const pendingQuestion = parsePendingQuestion(body.pendingQuestion, new Date());
    // Route questions ("What did you mean?", "Which plan?") exist only with
    // Pipeline V2 on (lib/pipeline/understand.ts); with it off one is dropped.
    if (pendingQuestion && (pendingQuestion.action === "delete" || TANGENT_PIPELINE_V2)) {
      const tapped = parseAnswers(body.answers).find((a) => a.id === PENDING_QUESTION_ID);
      const resolved =
        pendingQuestion.action === "route"
          ? await routeAnswerReply(tapped?.answer ?? userText, pendingQuestion, messages, { source, tapped: !!tapped })
          : await pendingAnswerReply(tapped?.answer ?? userText, pendingQuestion, { preview: !projectId || TANGENT_PIPELINE_V2, source });
      if (resolved) {
        if (body.stream !== true) return NextResponse.json(resolved);
        return new Response(JSON.stringify({ type: "result", ...resolved }) + "\n", {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    // Flag off: the Plan/Calendar switch decides, as before. Flag on there is
    // one box and no mode, except the Projects chat, which still talks a
    // project through in Plan mode.
    if (body.talk === true || (mode === "plan" && (!TANGENT_PIPELINE_V2 || projectId || aboutTask))) {
      // Asked from inside a project: the talk is about that project.
      const note = [projectId && !aboutTask ? await projectBrief(projectId, threadSummary) : null, aboutTask?.brief].filter(Boolean).join("\n\n");
      if (body.stream !== true) {
        const reply = await planReply(messages, { projectNote: note });
        return NextResponse.json({ message: reply, action: "plan_reply", mode, ok: true });
      }
      // Master fix Phase 4: the reply streams as {type:"reply_text"} lines.
      return ndjson(async (send) => {
        const reply = await planReply(messages, { projectNote: note, onText: (text) => send({ type: "reply_text", text }) });
        return { message: reply, action: "plan_reply", mode, ok: true };
      });
    }

    // Round 4 Phase 4: Home's box decides what this is before anything asks.
    // A question is answered from their projects and finished steps; more
    // steps for a project they have are previewed; only a new goal (or "grill
    // me") is asked about.
    //
    // Round 5A 2.1/2.5: talk first (lib/pipeline/talk-route.ts). A goal is
    // answered, with a "Plan this into my calendar" row when it could be
    // scheduled (`schedulable`); a plan is built only when asked in words or
    // with that button (`planThis`), and never after grill cards.
    let homeKind: HomeKind | null = null;
    const firstTurn = parseAnswers(body.answers).length === 0 && body.slotTurn == null;
    const planThis = body.planThis === true;
    if (body.home === true && body.talk !== true && body.route !== "chat" && body.newProject !== true && (firstTurn || planThis)) {
      const plans = await getAllPlans().catch(() => []);
      const scope = parseScope(body.scope);
      const routed = routeMessage(userText, { projects: plans.map((p) => ({ id: p.id, title: p.title })), scoped: projectId || null, planThis, scope });
      if (routed.kind === "report") {
        const logged = await logProgressReport(userText).catch(() => null);
        if (logged) {
          console.log("[api/chat] talk route: report (logged on a step)");
          if (body.stream !== true) return NextResponse.json(logged);
          return new Response(JSON.stringify({ type: "result", ...logged }) + "\n", {
            headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
          });
        }
        // No step it could be about: talk, never a new task.
        routed.kind = "answer";
      }
      homeKind = routed.kind;
      if (routed.projectId && !projectId) projectId = routed.projectId;
      console.log("[api/chat] talk route:", routed.kind, scope, routed.projectId ? "(project)" : "", routed.schedulable ? "schedulable" : "");
      if (routed.kind === "plan" || (routed.kind === "extend" && planThis)) {
        // Explicit: the brief, one question at most, then a draft to confirm
        // (Round 5A Q3: always previewed). Stages stream as they start.
        const goal = planRequestText(messages, { goal: typeof body.planGoal === "string" ? body.planGoal.slice(0, 2000) : null, answer: parsePlanAnswer(body.planAnswer) });
        const project: CalendarReplyOptions["project"] = projectId ? { projectId } : { forcePlan: true, projectGoal: goal.split("\n")[0].slice(0, 300) };
        const planned = (onProgress?: Parameters<typeof calendarReply>[2]) =>
          calendarReply(messages, aboutTask ? `${goal}\n\n${aboutTask.brief}` : goal, onProgress, { project, preview: true, source }).then((r) => ({ ...r, planGoal: goal.split("\n\nMy answers")[0] }));
        if (body.stream !== true) return NextResponse.json(await planned());
        return ndjson(async (send) => planned(send));
      }
      if (routed.kind === "action" && routed.action) {
        // Round 5A 1.6: a bulk command. A confirm card with counts; never
        // planned, never asked about.
        const today = localNow(await getUserTimezone()).date;
        const reply = await proposeBulk(routed.action, today, { getAllTasks, getAllPlans, countChatSessions, addPendingConfirmation });
        await addVoiceLog({ text: userText, response: String(reply.response ?? reply.message ?? ""), action: String(reply.action), ok: true }).catch(() => {});
        if (body.stream !== true) return NextResponse.json(reply);
        return new Response(JSON.stringify({ type: "result", ...reply }) + "\n", {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      }
      if (routed.kind === "answer") {
        // The project it's about, or their newest few when it names none (a
        // brand-new goal leans on what they've told Tangent, not old projects).
        const ids = projectId
          ? [projectId]
          : routed.schedulable
            ? []
            : [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3).map((p) => p.id);
        const notes = [
          ...(aboutTask ? [`THE STEP THEY'RE ASKING ABOUT:\n${aboutTask.brief}`] : []),
          ...(await Promise.all(ids.map((id) => projectBrief(id, threadSummary).catch(() => null)))).filter((n): n is string => !!n),
        ];
        // Talk mode: a real, specific answer in markdown; nothing is added.
        const answer = async (onText?: (text: string) => void) => ({
          ok: true,
          action: "chat_reply",
          message: (await talkReply(messages, { projectId: projectId || null, projectNotes: notes, onText })).text,
          schedulable: routed.schedulable,
          planGoal: routed.schedulable ? userText.slice(0, 2000) : undefined,
          ...(projectId ? { projectId } : {}),
        });
        if (body.stream !== true) return NextResponse.json(await answer());
        return ndjson(async (send) => answer((text) => send({ type: "reply_text", text })));
      }
      if (routed.kind === "extend" && projectId) {
        const extended = await extendPlan(projectId, userText, source);
        if (!extended.ok) {
          return NextResponse.json({ ok: true, action: extended.reason === "no_tasks" ? "chat_reply" : "error", message: extended.message });
        }
        const data = (await extended.response.json()) as Record<string, unknown>;
        if (data.ok !== true) return NextResponse.json({ ok: true, action: "error", message: String(data.response ?? data.error ?? "Sorry, I couldn't prepare that.") });
        return NextResponse.json({ ok: true, action: "preview", message: String(data.response ?? ""), changeSet: data.changeSet, preview: data.preview, projectId });
      }
    }
    // A plain task or a change: never grilled. A new goal or "grill me": asked.
    const mayAsk = homeKind === null || homeKind === "plan" || homeKind === "grill";

    // Instant capture: a plain to-do is saved straight away — no model in the
    // way — and polished a moment later by /api/questions (enrich). Anything
    // that might be a command goes through the full pipeline below.
    if (body.capture === true && messages.length === 1 && !projectId && homeKind !== "grill" && homeKind !== "plan") {
      const tzNow = await getUserTimezone();
      const quick = quickCapture(userText, tzNow);
      if (quick) return NextResponse.json(await saveQuickCapture(quick));
      const several = splitCaptureItems(userText, tzNow);
      if (several) return NextResponse.json(await saveQuickCaptures(several));
    }

    // Answers to Tangent's questions ride along with the original request, so
    // the pipeline sees one complete ask. A capacity answer is saved for good.
    const answers = parseAnswers(body.answers).filter((a) => a.id !== PENDING_QUESTION_ID);
    // "Part of your … project? Yes, add to it": the steps join that project
    // instead of starting a second one beside it.
    const joins = answers.find((a) => a.id.startsWith(PROJECT_QUESTION_PREFIX) && a.answer === PROJECT_YES);
    if (joins && !projectId) projectId = joins.id.slice(PROJECT_QUESTION_PREFIX.length);
    let pipelineText = userText;
    let slotDrafted = false;
    // "I have enough to start round 1": shown with the draft it led to.
    let grillNote: string | undefined;
    const slotTurn = parseSlotTurn(body.slotTurn);
    if (slotTurn?.stopped) trackEvent("grill_stopped", { count: slotTurn.answers.length, source: "slots" });
    if (
      body.slotFlow === true &&
      answers.length === 0 &&
      body.route !== "chat" &&
      body.clarify === true &&
      mayAsk &&
      (slotTurn !== null || body.newProject === true || homeKind === "grill" || !!projectId || shouldConsiderClarifying(userText))
    ) {
      // A request that may belong to an existing project keeps the older
      // "Part of your … project?" question (and so the older path).
      const plans = projectId || body.newProject === true ? [] : await getAllPlans().catch(() => []);
      const joinsExisting = !projectId && body.newProject !== true && slotTurn === null && matchProject(userText, plans) !== null;
      if (!joinsExisting) {
        const title = projectId ? (await getAllPlans().catch(() => [])).find((p) => p.id === projectId)?.title : undefined;
        // A project they have tells the grill what it's about and what's done,
        // so it never asks what the project already answers.
        const known = projectId ? ((await projectBrief(projectId, threadSummary).catch(() => null)) ?? "") : "";
        const chat = [known, messages.slice(0, -1).filter((m) => m.role === "user").map((m) => m.content).join("\n")].filter(Boolean).join("\n").slice(-3000);
        const turn = await grillTurn({ text: userText, chat, projectId: projectId || null, title, turn: slotTurn }).catch(() => ({ kind: "fallback" as const }));
        if (turn.kind === "ask") {
          const reply = {
            ok: true,
            action: "clarify",
            message: turn.cards.length > 1 ? "A few quick questions so this fits you." : "One quick question so this fits you.",
            questions: turn.cards.map((c) => ({ id: `slot:${c.slot}`, question: c.question, options: c.options, ...(c.multi ? { multi: true } : {}), ...(c.assume ? { assume: c.assume } : {}) })),
            slotFlow: { slots: turn.cards.map((c) => c.slot), progress: turn.progress },
            ...(projectId ? { projectId } : {}),
          };
          if (body.stream !== true) return NextResponse.json(reply);
          return new Response(JSON.stringify({ type: "result", ...reply }) + "\n", {
            headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
          });
        }
        if (turn.kind === "draft") {
          slotDrafted = true;
          if (slotTurn && slotTurn.answers.length > 0) trackEvent("grill_answered", { count: slotTurn.answers.length, source: "slots" });
          if (slotTurn && slotTurn.skipped.length > 0) trackEvent("grill_skipped", { count: slotTurn.skipped.length, source: "slots" });
          if (slotTurn) {
            logStepEvents([
              ...slotTurn.answers.map((a) => ({ kind: "question_answer" as const, code: toCode(a.slot) })),
              ...slotTurn.skipped.map((k) => ({ kind: "question_skip" as const, code: toCode(k) })),
              ...(slotTurn.stopped ? [{ kind: "plan_stop" as const }] : []),
            ]);
          }
          if (turn.notes) pipelineText = `${userText}\n\n${turn.notes}`;
          if (turn.enough) grillNote = turn.message;
        }
      }
    }
    if (slotDrafted) {
      // Grilled already: straight to the plan.
    } else if (answers.length > 0) {
      for (const a of answers) {
        if (a.id !== CAPACITY_QUESTION.id) continue;
        const weekday = capacityFromAnswer(a.answer);
        if (weekday) await setCapacity({ weekday, weekend: Math.min(720, Math.round(weekday * 1.6)) });
      }
      pipelineText = `${userText}\n\nMy answers to your questions:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`;
    } else if (!slotTurn?.stopped && body.route !== "chat" && body.clarify === true && mayAsk && (body.newProject === true || homeKind === "grill" || shouldConsiderClarifying(userText))) {
      // A new project is always grilled first: it's the biggest ask there is.
      const picture = await buildStudentContext({ purpose: "grill", query: userText }).catch(() => null);
      const questions = picture
        ? await clarifyQuestions(userText, picture.text, {
            askCapacity: !picture.capacityKnown,
            chat: messages.slice(0, -1).filter((m) => m.role === "user").map((m) => m.content).join("\n").slice(-2000),
            projects: projectId ? [] : picture.projects,
            newProject: body.newProject === true,
          }).catch(() => [])
        : [];
      if (questions.length > 0) {
        const reply = { ok: true, action: "clarify", message: "A few quick questions so this fits you.", questions };
        if (body.stream !== true) return NextResponse.json(reply);
        return new Response(JSON.stringify({ type: "result", ...reply }) + "\n", {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }

    // Projects: inside one, the request carries the project so the model knows
    // what it's adding to, and its steps join it; a new project always builds
    // a plan, with the student's first words as its goal.
    let project: CalendarReplyOptions["project"];
    if (aboutTask) pipelineText = `${pipelineText}\n\n${aboutTask.brief}`;
    if (projectId) {
      const found = aboutTask ? "" : await projectBrief(projectId, threadSummary);
      // A task's note already lists its project's other steps.
      if (found !== null) {
        project = { projectId };
        if (found) pipelineText = `${pipelineText}\n\n${found}`;
      }
    } else if (body.newProject === true) {
      project = { forcePlan: true, projectGoal: userText.slice(0, 300) };
    }

    // Pipeline V2: every message goes through the intake (lib/pipeline/intake.ts),
    // so anything the AI writes is a preview card first; route "chat" is the
    // "Just talking" re-ask. Project requests skip the intake but are drafted
    // too (A6): a ChangeSet of add_task ops with plan_id, confirmed on its
    // preview card in Tangent AI.
    // Flag off: straight to the voice pipeline, as on main; project requests
    // save directly (with Undo).
    const reply = (onProgress?: Parameters<typeof calendarReply>[2]) =>
      TANGENT_PIPELINE_V2 && !project
        ? handleRequest(messages, {
            onProgress,
            route: body.route === "chat" ? "chat" : undefined,
            pipelineText,
            answered: answers.length > 0 || slotDrafted,
            source,
            clarify: body.clarify === true,
            openTask: aboutTask ? { title: aboutTask.title, when: aboutTask.when } : null,
          })
        : calendarReply(messages, pipelineText, onProgress, { project, preview: !project || TANGENT_PIPELINE_V2 });

    const withNote = (r: Record<string, unknown>) => (grillNote && r.action === "preview" ? { ...r, grillNote } : r);
    if (body.stream !== true) return NextResponse.json(withNote(await reply()));

    // Streamed: one JSON object per line. Plan progress ({type:"plan_outline"},
    // {type:"plan_task"}) and talked reply text ({type:"reply_text"}) as it's
    // generated, then {type:"result", ...} with the same fields as the
    // non-streamed reply. Tasks are only saved at the end.
    return ndjson(async (send) => withNote(await reply(send)));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});

/** One JSON object per line: whatever `run` sends, then {type:"result", ...}. */
function ndjson(run: (send: (line: object) => void) => Promise<Record<string, unknown>>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (line: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        } catch {
          // The student pressed Stop: the reader is gone, the work finishes quietly.
          open = false;
        }
      };
      try {
        const result = await run(send);
        send({ type: "result", ...result });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[api/chat] Unhandled error:", message);
        send({ type: "result", ok: false, error: message });
      }
      if (open) controller.close();
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}

const SCOPES: readonly TalkScope[] = ["home", "capture", "task", "project", "rail", "palette"];
function parseScope(raw: unknown): TalkScope {
  return SCOPES.includes(raw as TalkScope) ? (raw as TalkScope) : "home";
}

function parsePlanAnswer(raw: unknown): { question: string; answer: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const { question, answer } = raw as { question?: unknown; answer?: unknown };
  if (typeof question !== "string" || typeof answer !== "string" || !answer.trim()) return null;
  return { question: question.slice(0, 300), answer: answer.trim().slice(0, 500) };
}
