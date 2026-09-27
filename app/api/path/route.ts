import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  addPathNode,
  addPathNodes,
  clearSuggestions,
  getPathNode,
  getPathSpace,
  pathAncestry,
  removePathNode,
  setGoal,
  updatePathNode,
} from "@/lib/store";
import type { AnchorKind, PathNode, TangentStatus } from "@/lib/types";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";
// Claude drafts three branches per node.
export const maxDuration = 60;

const CATEGORIES: AnchorKind[] = ["ec", "award", "course", "project"];
const STATUSES: TangentStatus[] = ["suggested", "accepted", "done", "dismissed"];

/** Three branches, never more. The panel shows one node at a time, and a wall of
 *  options is the opposite of a next step. */
const BranchSchema = z.object({
  branches: z
    .array(
      z.object({
        title: z
          .string()
          .describe("One concrete move, written as an instruction the student can act on this month."),
        rationale: z
          .string()
          .describe("One sentence: what this adds to the record that the parent work alone does not show."),
        effort: z.string().describe('Rough commitment, e.g. "2 hrs/wk for 6 weeks" or "one weekend".'),
      })
    )
    .length(3),
});

const SYSTEM = `You extend a high school student's existing work toward a specific college goal.

You are given a chain: the college they are aiming at, and the path of work and ideas
leading down to the one thing they want to branch off now. Propose exactly three branches
off the last item in that chain.

Rules:
- Branch off what they already have. Never propose starting something unrelated.
- Each branch must be a concrete action, not a theme. "Ask the robotics coach to let you run CAD for regionals", not "develop leadership skills".
- Each branch must be doable by a student with a few hours a week, no budget, and no adult connections they do not already have.
- Vary the angle across the three: one that deepens the work, one that widens its audience or output, one that connects it to a second interest.
- The deeper the chain, the more specific you get. A branch off a branch is a next step, not a restatement.
- Write to the student as "you". No preamble, no flattery, no mention of admissions officers.
- Never claim a branch guarantees anything about admission.`;

function nodeLine(n: PathNode): string {
  const bits = [n.title];
  if (n.detail) bits.push(n.detail);
  if (n.effort) bits.push(n.effort);
  if (n.hoursPerWeek) bits.push(`${n.hoursPerWeek} hrs/wk`);
  if (n.years) bits.push(`${n.years} year${n.years === 1 ? "" : "s"}`);
  return bits.join(" - ");
}

async function GETHandler() {
  return NextResponse.json(getPathSpace());
}

async function POSTHandler(req: Request) {
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
    const focus = String(body.focus ?? "").trim() || undefined;
    return NextResponse.json({ goal: setGoal(college, focus) });
  }

  if (action === "addNode") {
    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

    const parentId = body.parentId ? String(body.parentId) : null;
    if (parentId && !getPathNode(parentId)) {
      return NextResponse.json({ error: "No such parent." }, { status: 404 });
    }

    // Depth decides what a node is: children of the goal and of ideas are work,
    // children of work are ideas. The client never has to get this right.
    const parent = parentId ? getPathNode(parentId) : null;
    const kind = parent?.kind === "work" ? "idea" : "work";

    const rawCategory = String(body.category ?? "");
    const node = addPathNode({
      parentId,
      kind,
      title,
      detail: String(body.detail ?? "").trim() || undefined,
      rationale: String(body.rationale ?? "").trim() || undefined,
      effort: String(body.effort ?? "").trim() || undefined,
      category: kind === "work" && CATEGORIES.includes(rawCategory as AnchorKind)
        ? (rawCategory as AnchorKind)
        : kind === "work"
          ? "ec"
          : undefined,
      hoursPerWeek: Number.isFinite(Number(body.hoursPerWeek)) && Number(body.hoursPerWeek) > 0
        ? Number(body.hoursPerWeek)
        : undefined,
      years: Number.isFinite(Number(body.years)) && Number(body.years) > 0 ? Number(body.years) : undefined,
      origin: "you",
      status: kind === "work" ? "accepted" : "suggested",
    });
    return NextResponse.json({ node });
  }

  if (action === "setStatus") {
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    if (!STATUSES.includes(status as TangentStatus)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const updated = updatePathNode(id, { status: status as TangentStatus });
    if (!updated) return NextResponse.json({ error: "No such node." }, { status: 404 });
    return NextResponse.json({ node: updated });
  }

  if (action === "removeNode") {
    const id = String(body.id ?? "");
    const removed = removePathNode(id);
    return NextResponse.json({ ok: true, removed });
  }

  if (action === "generate") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set, so Tangent can't draft branches yet." },
        { status: 503 }
      );
    }

    const { goal, nodes } = getPathSpace();
    if (!goal) return NextResponse.json({ error: "Set a college goal first." }, { status: 400 });

    const parentId = String(body.parentId ?? "");
    const parent = getPathNode(parentId);
    if (!parent) return NextResponse.json({ error: "No such node." }, { status: 404 });

    const chain = pathAncestry(parentId);
    const siblings = nodes
      .filter((n) => n.parentId === parent.parentId && n.id !== parent.id)
      .map(nodeLine);

    const prompt = [
      `Goal: ${goal.college}${goal.focus ? ` (${goal.focus})` : ""}`,
      `The chain down to what they want to branch off:\n${chain
        .map((n, i) => `${"  ".repeat(i)}${i + 1}. ${nodeLine(n)}`)
        .join("\n")}`,
      siblings.length
        ? `Alongside it, for context and cross-connections:\n${siblings.map((s) => `- ${s}`).join("\n")}`
        : "Nothing else sits alongside it yet.",
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

      clearSuggestions(parent.id);
      const kind = parent.kind === "work" ? "idea" : "work";
      const created = addPathNodes(
        parsed.branches.map((b) => ({
          parentId: parent.id,
          kind,
          title: b.title,
          rationale: b.rationale,
          effort: b.effort,
          origin: "tangent" as const,
          status: "suggested" as const,
        }))
      );
      return NextResponse.json({ nodes: created });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[api/path] generate failed:", message);
      return NextResponse.json({ error: "Tangent couldn't reach Claude just now." }, { status: 502 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// Runs against the caller's own workspace, loaded and saved around the request.
export const GET = withWorkspaceRoute(GETHandler);
export const POST = withWorkspaceRoute(POSTHandler);
