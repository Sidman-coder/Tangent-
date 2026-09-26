import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  addAnchor,
  addTangents,
  clearSuggestions,
  getTangentSpace,
  removeAnchor,
  setGoal,
  setTangentStatus,
} from "@/lib/store";
import type { Anchor, AnchorKind, TangentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const ANCHOR_KINDS: AnchorKind[] = ["ec", "award", "course", "project"];

/** What Claude must return. Three branches per anchor, no more — the page shows
 *  one anchor at a time and a wall of options is the opposite of a next step. */
const BranchSchema = z.object({
  branches: z
    .array(
      z.object({
        title: z
          .string()
          .describe("One concrete move, written as an instruction the student can act on this month."),
        rationale: z
          .string()
          .describe("One sentence: what this adds to the record that the anchor alone does not show."),
        effort: z
          .string()
          .describe('Rough commitment, e.g. "2 hrs/wk for 6 weeks" or "one weekend".'),
      })
    )
    .length(3),
});

const SYSTEM = `You extend a high school student's existing work toward a specific college goal.

You are given one thing the student already does (the anchor) and the college they are aiming at.
Propose exactly three branches off that anchor.

Rules:
- Branch off what they already have. Never propose starting something unrelated.
- Each branch must be a concrete action, not a theme. "Ask the robotics coach to let you run CAD for regionals" — not "develop leadership skills".
- Each branch must be doable by a student with a few hours a week, no budget, and no adult connections they do not already have.
- Vary the angle across the three: one that deepens the anchor, one that widens its audience or output, one that connects it to a second interest.
- Write to the student as "you". No preamble, no flattery, no mention of admissions officers.
- Never claim a branch guarantees anything about admission.`;

function anchorLine(a: Anchor): string {
  const bits = [a.title];
  if (a.detail) bits.push(a.detail);
  if (a.hoursPerWeek) bits.push(`${a.hoursPerWeek} hrs/wk`);
  if (a.years) bits.push(`${a.years} year${a.years === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

export async function GET() {
  return NextResponse.json(getTangentSpace());
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const action = String(body.action ?? "");

  if (action === "setGoal") {
    const college = String(body.college ?? "").trim();
    if (!college) return NextResponse.json({ error: "A college is required." }, { status: 400 });
    const focus = body.focus ? String(body.focus).trim() || undefined : undefined;
    return NextResponse.json({ goal: setGoal(college, focus) });
  }

  if (action === "addAnchor") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
    const kindRaw = String(body.kind ?? "ec") as AnchorKind;
    const kind = ANCHOR_KINDS.includes(kindRaw) ? kindRaw : "ec";
    const hours = Number(body.hoursPerWeek);
    const years = Number(body.years);
    return NextResponse.json({
      anchor: addAnchor({
        title,
        kind,
        detail: body.detail ? String(body.detail).trim() || undefined : undefined,
        hoursPerWeek: Number.isFinite(hours) && hours > 0 ? hours : undefined,
        years: Number.isFinite(years) && years > 0 ? years : undefined,
      }),
    });
  }

  if (action === "removeAnchor") {
    removeAnchor(String(body.id ?? ""));
    return NextResponse.json({ ok: true });
  }

  if (action === "setStatus") {
    const updated = setTangentStatus(String(body.id ?? ""), String(body.status ?? "") as TangentStatus);
    if (!updated) return NextResponse.json({ error: "No such tangent." }, { status: 404 });
    return NextResponse.json({ tangent: updated });
  }

  if (action === "addTangent") {
    const anchorId = String(body.anchorId ?? "");
    const title = String(body.title ?? "").trim();
    if (!anchorId || !title) {
      return NextResponse.json({ error: "anchorId and title are required." }, { status: 400 });
    }
    const [created] = addTangents([
      {
        anchorId,
        title,
        rationale: String(body.rationale ?? "").trim(),
        effort: String(body.effort ?? "").trim(),
        status: "accepted",
        origin: "you",
      },
    ]);
    return NextResponse.json({ tangent: created });
  }

  if (action === "generate") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set, so Tangent can't draft branches yet." },
        { status: 503 }
      );
    }
    const { goal, anchors } = getTangentSpace();
    if (!goal) return NextResponse.json({ error: "Set a college goal first." }, { status: 400 });

    const anchorId = String(body.anchorId ?? "");
    const anchor = anchors.find((a) => a.id === anchorId);
    if (!anchor) return NextResponse.json({ error: "No such anchor." }, { status: 404 });

    const others = anchors.filter((a) => a.id !== anchor.id).map(anchorLine);
    const prompt = [
      `Goal: ${goal.college}${goal.focus ? ` — ${goal.focus}` : ""}`,
      `Anchor to branch off: ${anchorLine(anchor)}`,
      others.length ? `Their other work, for context and for cross-connections:\n${others.map((o) => `- ${o}`).join("\n")}` : "This is currently their only recorded activity.",
    ].join("\n\n");

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(BranchSchema) },
      });

      const parsed = response.parsed_output;
      if (!parsed) {
        return NextResponse.json({ error: "Tangent couldn't draft branches this time." }, { status: 502 });
      }

      clearSuggestions(anchor.id);
      const created = addTangents(
        parsed.branches.map((b) => ({
          anchorId: anchor.id,
          title: b.title,
          rationale: b.rationale,
          effort: b.effort,
          status: "suggested" as const,
          origin: "tangent" as const,
        }))
      );
      return NextResponse.json({ tangents: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[api/tangents] generate failed:", message);
      return NextResponse.json({ error: "Tangent couldn't reach Claude just now." }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
