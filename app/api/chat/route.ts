import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { calendarReply, lastUserMessage, planReply, type CalendarReplyOptions } from "@/lib/chat-reply";
import { TANGENT_PIPELINE_V2 } from "@/lib/pipeline/flags";
import { handleRequest } from "@/lib/pipeline/intake";
import { addTask, getAllPlans, getAllTasks, getUserTimezone, recordAction, setCapacity } from "@/lib/store";
import { quickCapture, type QuickCapture } from "@/lib/ai/router";
import { inferCalendarGroup } from "@/lib/calendars";
import { dayName } from "@/lib/load";
import { formatTime12 } from "@/lib/dates";
import { CAPACITY_QUESTION, capacityFromAnswer, clarifyQuestions, shouldConsiderClarifying } from "@/lib/ai/clarify";
import { buildStudentContext } from "@/lib/ai/student-context";
import { placeNewTask, reliefSuggestion } from "@/lib/spacing";
import { addDaysYMD, localNow } from "@/lib/time";
import { cleanTitle } from "@/lib/quick-add";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Calendar mode runs a multi-turn Claude tool loop; measured at ~48s in
// production. With no maxDuration declared, the platform default killed it
// partway through and the console blamed a missing API key.
export const maxDuration = 60;

/** "calendar" acts on the calendar; "plan" only talks a plan through. */
type ChatMode = "plan" | "calendar";

/** What the model needs to know about the project a request was made in. */
async function projectBrief(projectId: string): Promise<string | null> {
  const plan = (await getAllPlans()).find((p) => p.id === projectId);
  if (!plan) return null;
  const steps = (await getAllTasks())
    .filter((t) => t.planId === projectId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 30)
    .map((t) => `- ${t.completed ? "[done] " : ""}${t.title} (${t.date})`);
  return `(This request is inside the student's project "${plan.title}".${plan.description ? ` Goal: ${plan.description}.` : ""} Anything you add belongs to this project. Its steps so far:\n${steps.join("\n") || "none yet"})`;
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
  const tz = await getUserTimezone();
  const today = localNow(tz).date;
  const day =
    task.date === today ? "today" : task.date === addDaysYMD(today, 1) ? "tomorrow" : `${dayName(task.date)}`;
  return {
    ok: true,
    action: "add_task",
    message: `Added ${task.title} for ${day} at ${formatTime12(task.time)}.${placed.note ? ` ${placed.note}` : ""}`,
    actionId: record.id,
    taskId: task.id,
    taskDate: task.date,
    quick: true,
    suggestion: await reliefSuggestion(),
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
      /** "New project" on the Projects page: always builds a plan. */
      newProject?: unknown;
      /** Pipeline V2: "chat" is the "Just talking, don't add" re-ask. */
      route?: unknown;
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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "Missing ANTHROPIC_API_KEY on the server." }, { status: 401 });
    }

    console.log("[api/chat] User message:", userText);

    const projectId = typeof body.projectId === "string" && body.projectId ? body.projectId : "";

    // Flag off: the Plan/Calendar switch decides, as before. Flag on there is
    // one box and no mode, except the Projects chat, which still talks a
    // project through in Plan mode.
    if (mode === "plan" && (!TANGENT_PIPELINE_V2 || projectId)) {
      // Asked from inside a project: the talk is about that project.
      const note = projectId ? (await projectBrief(projectId)) ?? "" : "";
      const reply = await planReply(messages, { projectNote: note });
      return NextResponse.json({ message: reply, action: "plan_reply", mode, ok: true });
    }

    // Instant capture: a plain to-do is saved straight away — no model in the
    // way — and polished a moment later by /api/questions (enrich). Anything
    // that might be a command goes through the full pipeline below.
    if (body.capture === true && messages.length === 1) {
      const quick = quickCapture(userText, await getUserTimezone());
      if (quick) return NextResponse.json(await saveQuickCapture(quick));
    }

    // Answers to Tangent's questions ride along with the original request, so
    // the pipeline sees one complete ask. A capacity answer is saved for good.
    const answers = parseAnswers(body.answers);
    let pipelineText = userText;
    if (answers.length > 0) {
      for (const a of answers) {
        if (a.id !== CAPACITY_QUESTION.id) continue;
        const weekday = capacityFromAnswer(a.answer);
        if (weekday) await setCapacity({ weekday, weekend: Math.min(720, Math.round(weekday * 1.6)) });
      }
      pipelineText = `${userText}\n\nMy answers to your questions:\n${answers.map((a) => `- ${a.question} ${a.answer}`).join("\n")}`;
    } else if (body.route !== "chat" && body.clarify === true && (body.newProject === true || shouldConsiderClarifying(userText))) {
      // A new project is always grilled first: it's the biggest ask there is.
      const picture = await buildStudentContext().catch(() => null);
      const questions = picture
        ? await clarifyQuestions(userText, picture.text, { askCapacity: !picture.capacityKnown }).catch(() => [])
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
    if (projectId) {
      const found = await projectBrief(projectId);
      if (found) {
        project = { projectId };
        pipelineText = `${pipelineText}\n\n${found}`;
      }
    } else if (body.newProject === true) {
      project = { forcePlan: true, projectGoal: userText.slice(0, 300) };
    }

    // Pipeline V2: every message goes through the intake (lib/pipeline/intake.ts),
    // so anything the AI writes is a preview card first; route "chat" is the
    // "Just talking" re-ask. Project requests skip it: the Projects chat has no
    // preview card, so they save directly as on main (with Undo).
    // Flag off: straight to the voice pipeline, as on main.
    const reply = (onProgress?: Parameters<typeof calendarReply>[2]) =>
      TANGENT_PIPELINE_V2 && !project
        ? handleRequest(messages, {
            onProgress,
            route: body.route === "chat" ? "chat" : undefined,
            pipelineText,
            answered: answers.length > 0,
          })
        : calendarReply(messages, pipelineText, onProgress, { project, preview: !project });

    if (body.stream !== true) return NextResponse.json(await reply());

    // Streamed: one JSON object per line. Plan progress ({type:"plan_outline"},
    // {type:"plan_task"}) as it's generated, then {type:"result", ...} with the
    // same fields as the non-streamed reply. Tasks are only saved at the end.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (line: unknown) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
        try {
          const result = await reply(send);
          send({ type: "result", ...result });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Unknown error";
          console.error("[api/chat] Unhandled error:", message);
          send({ type: "result", ok: false, error: message });
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] Unhandled error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});
