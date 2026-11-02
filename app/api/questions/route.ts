import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { getUserTimezone, recordAction, setCapacity, updateTask } from "@/lib/store";
import { CAPACITY_QUESTION, capacityFromAnswer, captureQuestions } from "@/lib/ai/clarify";
import { refineTask } from "@/lib/ai/refine";
import { buildStudentContext } from "@/lib/ai/student-context";
import { extractContextFacts } from "@/lib/context-extract";
import { placeNewTask } from "@/lib/spacing";
import { closeQuestions, openQuestionSets, queueQuestions } from "@/lib/task-questions";
import { categoryPatch } from "@/lib/capture-category";
import { promptDateContext } from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** GET — the student's open question sets, newest first. */
export const GET = withUser(async () => {
  return NextResponse.json({ ok: true, sets: await openQuestionSets() });
});

type Body =
  | { action: "generate"; taskId: string; request: string; enrich?: boolean }
  | { action: "answer"; id: string; answers: { id: string; question: string; answer: string }[] }
  | { action: "dismiss"; id: string };

/**
 * POST
 * - generate: questions about a task that was just saved (captures, quick
 *   asks). Called by the client after the save returns, so capture stays
 *   instant.
 * - answer: apply the answers — sharpen the task, re-place it if its timing
 *   changed, save a capacity answer, and teach Tangent's memory.
 * - dismiss: never mind.
 */
export const POST = withUser(async (req: Request) => {
  const body = (await req.json()) as Body;

  if (body.action === "generate") {
    if (!body.taskId) return NextResponse.json({ ok: false, error: "taskId required" }, { status: 400 });
    const task = await updateTask(body.taskId, {});
    if (!task) return NextResponse.json({ ok: false, error: "Task not found" }, { status: 404 });
    const picture = await buildStudentContext();
    const request = String(body.request ?? task.title).slice(0, 1000);
    // A quick capture was saved with the student's raw words; tidy it (title,
    // notes with a time estimate, first step) while the questions are written.
    const [questions, tidy] = await Promise.all([
      captureQuestions(task, request, picture.text),
      body.enrich
        ? refineTask(task, [], picture.text, promptDateContext(await getUserTimezone())).catch(() => null)
        : Promise.resolve(null),
    ]);
    if (tidy) {
      await updateTask(task.id, {
        title: tidy.title.trim() || task.title,
        notes: tidy.notes.trim() || task.notes,
        startAction: tidy.startAction.trim() || task.startAction,
        // Its color and calendar, from what it actually is (not title keywords).
        ...categoryPatch(tidy.category ?? "", task),
      });
    }
    if (!picture.capacityKnown && questions.length > 0 && questions.length < 3) questions.push(CAPACITY_QUESTION);
    const set = await queueQuestions({ id: task.id, title: tidy?.title.trim() || task.title }, request, questions);
    return NextResponse.json({ ok: true, set, tidied: Boolean(tidy) });
  }

  if (body.action === "dismiss") {
    await closeQuestions(body.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "answer") {
    const set = (await openQuestionSets()).find((s) => s.id === body.id);
    if (!set) return NextResponse.json({ ok: false, error: "Those questions are already answered." }, { status: 404 });
    const answers = (body.answers ?? []).filter((a) => a.answer?.trim()).slice(0, 4);
    await closeQuestions(set.id);
    if (answers.length === 0) return NextResponse.json({ ok: true, summary: null });

    for (const a of answers) {
      if (a.id !== CAPACITY_QUESTION.id) continue;
      const weekday = capacityFromAnswer(a.answer);
      if (weekday) await setCapacity({ weekday, weekend: Math.min(720, Math.round(weekday * 1.6)) });
    }

    // Every answer also teaches Tangent about the student.
    void extractContextFacts(
      `Student said: ${set.request}\n${answers.map((a) => `Tangent asked: ${a.question}\nStudent answered: ${a.answer}`).join("\n")}`,
      "chat"
    ).catch(() => {});

    const task = await updateTask(set.taskId, {});
    if (!task) return NextResponse.json({ ok: true, summary: "Saved your answers. That task is gone now." });

    const taskAnswers = answers.filter((a) => a.id !== CAPACITY_QUESTION.id);
    if (taskAnswers.length === 0) return NextResponse.json({ ok: true, summary: "Got it — saved." });

    const tz = await getUserTimezone();
    const picture = await buildStudentContext();
    const r = await refineTask(task, taskAnswers, picture.text, promptDateContext(tz));
    if (!r) return NextResponse.json({ ok: true, summary: "Saved your answers." });

    const timingChanged = Boolean(r.date || r.time || r.deadline);
    const placed = timingChanged
      ? await placeNewTask({ date: r.date || null, time: r.time || null, deadline: r.deadline || null, notes: r.notes })
      : null;
    const updated = await updateTask(task.id, {
      title: r.title.trim() || task.title,
      notes: r.notes.trim() || task.notes,
      startAction: r.startAction.trim() || task.startAction,
      ...(placed ? { date: placed.date, time: placed.time } : {}),
      // The answers often settle what it is ("it's for robotics").
      ...categoryPatch(r.category ?? "", task),
    });
    let actionId: string | undefined;
    if (placed && (placed.date !== task.date || placed.time !== task.time)) {
      const record = await recordAction("reschedule_task", `Moved "${task.title}" after your answers`, {
        rescheduled: { taskId: task.id, fromDate: task.date, fromTime: task.time },
      });
      actionId = record.id;
    }
    const summary = [r.summary.trim(), placed?.note].filter(Boolean).join(" ");
    return NextResponse.json({ ok: true, summary: summary || "Updated.", task: updated, actionId });
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
