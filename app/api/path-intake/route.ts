import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { buildStudentContext } from "@/lib/ai/student-context";
import { getPath, getPathNode, pathAncestry } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Starting a Tangent shouldn't begin with empty boxes. "prefill" drafts the
// intake's answers from what Tangent already knows (memory, projects, goals,
// schedule); "questions" grills the student on what the draft still lacks
// before the path is built. components/tangents/NewPathDialog.tsx.

const PREFILL_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    target: { type: "string" },
    current: { type: "string" },
    deadline: { type: "string" },
    hoursPerWeek: { type: "string" },
    standing: { type: "string" },
    constraints: { type: "string" },
  },
  required: ["title", "target", "current", "deadline", "hoursPerWeek", "standing", "constraints"],
  additionalProperties: false,
} as const;

const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { question: { type: "string" }, chips: { type: "array", items: { type: "string" } } },
        required: ["question", "chips"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
} as const;

const KIND_WORDS: Record<string, string> = {
  college: "getting into a school or programme",
  career: "landing a role",
  skill: "reaching a level (rating, grade, certification)",
  other: "a goal with a clear finish line",
};

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    kind?: string;
    title?: string;
    draft?: Record<string, string>;
    nodeId?: string;
  };
  const picture = await buildStudentContext();
  const kind = KIND_WORDS[body.kind ?? "other"] ?? KIND_WORDS.other;

  if (body.action === "prefill") {
    const r = await callClaude(
      "pathIntake",
      {
        system: `A high school student is starting a long-range goal in Tangent: ${kind}. Draft their intake answers from what Tangent already knows about them (context below) so they confirm instead of typing.

Rules: only use what the context actually supports — leave a field "" rather than guess. Write in their voice, short.
- title: 2–4 word name for the goal (e.g. "Georgia Tech CS").
- target: the specific finish line.
- current: where they honestly are now toward it.
- deadline: when, if known.
- hoursPerWeek: a number as text, only if they've said how much time they have.
- standing: what they already have going for it, one item per line.
- constraints: what's in the way.`,
        messages: [{ role: "user", content: `STUDENT CONTEXT:\n${picture.text}\n\nWHAT THEY TYPED (may be empty): ${body.title ?? ""}` }],
      },
      { format: { type: "json_schema", schema: PREFILL_SCHEMA } }
    );
    if (!r.ok) return NextResponse.json({ ok: false }, { status: 502 });
    try {
      return NextResponse.json({ ok: true, draft: extractStructuredJson<Record<string, string>>(r.message) });
    } catch {
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  }

  // Before drafting ideas off one item on a path ("CCR"), find out what
  // Tangent would otherwise guess: what it is, what they do there, how far
  // along they are. [] when the item is already clear enough.
  if (body.action === "nodeQuestions") {
    const node = body.nodeId ? await getPathNode(body.nodeId) : null;
    if (!node) return NextResponse.json({ ok: false, error: "No such item." }, { status: 404 });
    const [owning, chain] = await Promise.all([getPath(node.pathId), pathAncestry(node.id)]);
    const goal = owning?.path.target || owning?.path.title || "";
    const r = await callClaude(
      "pathIntake",
      {
        system: `You are TANGENT. A high school student is about to have you suggest next moves that branch off one item on their path toward a goal. Your suggestions are only as good as what you know about that item. Decide what you would otherwise be GUESSING, and ask about it.

Ask 1 to 3 questions when the item is unclear, especially:
- what it actually is, if the name is an acronym, a nickname or vague ("CCR", "the project", "club"). Always ask this one first in that case;
- what the student does there and their role or level;
- how far along they are, or what they've already done in it.

Ask nothing (return no questions) when the item's detail already says what it is, their role and how far along they are.

Never ask about the goal itself, their schedule or anything in their context. Each question under 12 words. Give 2–4 tap answers each when the likely answers are predictable; for "what is it" questions give none (they'll type it).`,
        messages: [
          {
            role: "user",
            content: `THE GOAL: ${goal}\n\nTHE ITEM: ${node.title}${node.detail ? `\nWhat Tangent knows about it: ${node.detail}` : "\nWhat Tangent knows about it: nothing"}${node.hoursPerWeek ? `\n${node.hoursPerWeek} hrs/week` : ""}${node.years ? `, ${node.years} years` : ""}\nWhere it sits: ${chain.map((n) => n.title).join(" > ")}\n\nSTUDENT CONTEXT (background only):\n${picture.text}`,
          },
        ],
      },
      { format: { type: "json_schema", schema: QUESTIONS_SCHEMA } }
    );
    if (!r.ok) return NextResponse.json({ ok: true, questions: [] });
    try {
      const q = extractStructuredJson<{ questions: { question: string; chips: string[] }[] }>(r.message).questions;
      return NextResponse.json({ ok: true, questions: q.slice(0, 3).map((x) => ({ question: x.question, chips: (x.chips ?? []).slice(0, 4) })) });
    } catch {
      return NextResponse.json({ ok: true, questions: [] });
    }
  }

  if (body.action === "questions") {
    const d = body.draft ?? {};
    const r = await callClaude(
      "pathIntake",
      {
        system: `You are TANGENT, about to map a high school student's path to ONE long-range goal (${kind}), named under THE GOAL below. Before building it, ask 1 to 3 questions about reaching THAT goal. Each one must pass this test: a different answer would make you suggest clearly different next steps toward it.

Every question is about the goal under THE GOAL. Use the student's context only to skip what you already know and to make the options specific. Never ask about a different goal, project or activity from their context unless it directly bears on this goal.

Good questions find the gap between where they are and the goal:
- where they stand now on what the goal actually requires (scores, rating, portfolio, experience), with real ranges as options;
- the hard constraint that shapes everything (deadline track, budget, transport, hours they really have);
- which of two genuinely different routes they lean toward (research vs. competitions, club team vs. coach).

Never ask:
- anything the intake or their context already answers (their goal, deadline, hours a week, activities, classes);
- how they feel, whether they're motivated, or whether something "matters" to them;
- yes/no questions about including something ("Will X be part of your story?");
- vague scope questions ("What's your focus?") or anything a counsellor would find obvious.

Each under 14 words, plain, specific to this goal and this student. 2–4 tap answers each, under 4 words, mutually exclusive, covering the realistic range. Fewer questions is better than a weak one.`,
        messages: [
          {
            role: "user",
            content: `THE GOAL: ${String(d.title ?? "").slice(0, 200)}${d.target && d.target !== d.title ? ` (${String(d.target).slice(0, 200)})` : ""}\n\nTHEIR INTAKE:\n${Object.entries(d)
              .map(([k, v]) => `${k}: ${String(v).slice(0, 400)}`)
              .join("\n")}\n\nSTUDENT CONTEXT (background only):\n${picture.text}`,
          },
        ],
      },
      { format: { type: "json_schema", schema: QUESTIONS_SCHEMA } }
    );
    if (!r.ok) return NextResponse.json({ ok: true, questions: [] });
    try {
      const q = extractStructuredJson<{ questions: { question: string; chips: string[] }[] }>(r.message).questions;
      return NextResponse.json({ ok: true, questions: q.slice(0, 3).map((x) => ({ question: x.question, chips: (x.chips ?? []).slice(0, 4) })) });
    } catch {
      return NextResponse.json({ ok: true, questions: [] });
    }
  }

  return NextResponse.json({ ok: false, error: "Unknown action" }, { status: 400 });
});
