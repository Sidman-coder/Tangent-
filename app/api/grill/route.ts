import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";
import { buildStudentContext } from "@/lib/ai/student-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Grill me": Tangent asks the one question whose answer would help it most,
// given everything it already knows. Called once per question by
// components/GetToKnowYou.tsx; the student answers by tapping, typing or
// speaking, and the answer is saved as a fact.

const SCHEMA = {
  type: "object",
  properties: {
    question: { type: "string" },
    why: { type: "string" },
    chips: { type: "array", items: { type: "string" } },
    category: { type: "string", enum: ["goal", "commitment", "work", "habit", "preference", "person", "general"] },
  },
  required: ["question", "why", "chips", "category"],
  additionalProperties: false,
} as const;

const SYSTEM = `You are TANGENT, a planner that knows a high school student well and wants to know them better. Ask the ONE question whose answer would most improve how you plan their week and point them at their goals.

- Aim at the biggest gap in what you know (their context is below). Never ask something it already answers, and never repeat a question already asked this session.
- Be specific to them: use their real classes, activities, deadlines and goals ("Is the robotics team for a competition this year?"), not generic survey questions.
- Under 14 words, direct, like a sharp older friend.
- "why": under 12 words, what Tangent will do with the answer.
- 2–4 likely answers as chips, under 4 words each.
- category: where the answer belongs.`;

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { asked?: unknown };
  const asked = (Array.isArray(body.asked) ? body.asked : []).filter((q): q is string => typeof q === "string").slice(-20);
  const picture = await buildStudentContext();
  const r = await callClaude(
    "grillNext",
    {
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `STUDENT CONTEXT:\n${picture.text}\n\nALREADY ASKED THIS SESSION:\n${asked.map((q) => `- ${q}`).join("\n") || "(none)"}`,
        },
      ],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!r.ok) return NextResponse.json({ ok: false, error: "Couldn't think of a question" }, { status: 502 });
  try {
    const q = extractStructuredJson<{ question: string; why: string; chips: string[]; category: string }>(r.message);
    return NextResponse.json({ ok: true, question: { ...q, chips: (q.chips ?? []).slice(0, 4) } });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't read the question" }, { status: 502 });
  }
});
