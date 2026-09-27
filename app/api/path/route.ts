import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import {
  addPathNode,
  addPathNodes,
  clearSuggestions,
  createPath,
  getPath,
  getPathNode,
  getPathSpace,
  pathAncestry,
  removePath,
  removePathNode,
  updatePath,
  updatePathNode,
} from "@/lib/store";
import type { AnchorKind, Path, PathGoalKind, PathNode, TangentStatus } from "@/lib/types";
import { withWorkspaceRoute } from "@/lib/with-workspace";

export const dynamic = "force-dynamic";
// Claude drafts three branches per node.
export const maxDuration = 60;

const CATEGORIES: AnchorKind[] = ["ec", "award", "course", "project"];
const STATUSES: TangentStatus[] = ["suggested", "accepted", "done", "dismissed"];
const KINDS: PathGoalKind[] = ["college", "career", "skill", "other"];

/** Three branches, never more. The panel shows one node at a time, and a wall of
 *  options is the opposite of a next step. */
const BranchSchema = z.object({
  branches: z
    .array(
      z.object({
        title: z
          .string()
          .describe("One concrete move, written as an instruction the person can act on this month."),
        rationale: z
          .string()
          .describe("One sentence: what this adds that the parent work alone does not."),
        effort: z.string().describe('Rough commitment, e.g. "2 hrs/wk for 6 weeks" or "one weekend".'),
      })
    )
    .length(3),
});

/** What the intake is for: every branch is judged against these five facts. */
const SYSTEM = `You extend someone's existing work toward a goal they have stated.

The goal can be anything with a target you could verify: a university place, a job,
a chess rating, a certification, a body of work. Never assume it is about college.

You are given the goal, where they are now, their deadline, the hours a week they
can actually give it, what is in their way, and the chain of work and ideas leading
down to the one thing they want to branch off now. Propose exactly three branches
off the last item in that chain.

Rules:
- Branch off what they already have. Never propose starting something unrelated.
- Each branch is a concrete action, not a theme. "Ask the coach to let you run CAD for regionals", not "develop leadership skills".
- Respect the stated hours a week and the stated constraints. A branch they cannot afford, reach, or fit is a wasted branch.
- Vary the angle across the three: one that deepens the work, one that widens its audience or output, one that connects it to a second interest.
- The deeper the chain, the more specific you get. A branch off a branch is a next step, not a restatement.
- Write to them as "you". No preamble, no flattery.
- Never claim a branch guarantees the goal.`;

function nodeLine(n: PathNode): string {
  const bits = [n.title];
  if (n.detail) bits.push(n.detail);
  if (n.effort) bits.push(n.effort);
  if (n.hoursPerWeek) bits.push(`${n.hoursPerWeek} hrs/wk`);
  if (n.years) bits.push(`${n.years} year${n.years === 1 ? "" : "s"}`);
  return bits.join(" - ");
}

function pathBrief(path: Path): string {
  return [
    `Goal: ${path.target || path.title}`,
    path.current ? `Where they are now: ${path.current}` : null,
    path.deadline ? `By: ${path.deadline}` : null,
    path.hoursPerWeek ? `Hours a week available: ${path.hoursPerWeek}` : null,
    path.constraints ? `In the way: ${path.constraints}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function GETHandler(req: Request) {
  const pathId = new URL(req.url).searchParams.get("pathId");
  if (!pathId) {
    // The gallery only needs each Path plus how much has grown in it.
    const { paths, nodes } = getPathSpace();
    return NextResponse.json({
      paths: paths.map((p) => {
        const own = nodes.filter((n) => n.pathId === p.id);
        return {
          ...p,
          counts: {
            work: own.filter((n) => n.kind === "work").length,
            ideas: own.filter((n) => n.kind === "idea").length,
            kept: own.filter((n) => n.status === "accepted" || n.status === "done").length,
            done: own.filter((n) => n.status === "done").length,
          },
        };
      }),
    });
  }

  const found = getPath(pathId);
  if (!found) return NextResponse.json({ error: "No such path." }, { status: 404 });
  return NextResponse.json(found);
}

async function POSTHandler(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const action = str(body.action);

  // ─── Paths ────────────────────────────────────────────────────────────────

  if (action === "createPath") {
    const title = str(body.title);
    if (!title) return NextResponse.json({ error: "Give the path a name." }, { status: 400 });

    const rawKind = str(body.kind);
    const path = createPath({
      title,
      kind: KINDS.includes(rawKind as PathGoalKind) ? (rawKind as PathGoalKind) : "other",
      target: str(body.target),
      current: str(body.current),
      deadline: str(body.deadline) || undefined,
      hoursPerWeek: num(body.hoursPerWeek),
      constraints: str(body.constraints) || undefined,
      standing: str(body.standing) || undefined,
    });

    // What they already have becomes the first circle, so the path is never
    // born empty. One line each, however they wrote it.
    const seeds = str(body.standing)
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
    const created = addPathNodes(
      seeds.map((title) => ({
        pathId: path.id,
        parentId: null,
        kind: "work" as const,
        title,
        category: "ec" as AnchorKind,
        origin: "you" as const,
        status: "accepted" as const,
      }))
    );

    return NextResponse.json({ path, seeded: created.length });
  }

  if (action === "updatePath") {
    const id = str(body.id);
    const patch: Partial<Path> = {};
    if (body.title !== undefined) patch.title = str(body.title);
    if (body.target !== undefined) patch.target = str(body.target);
    if (body.current !== undefined) patch.current = str(body.current);
    if (body.deadline !== undefined) patch.deadline = str(body.deadline) || undefined;
    if (body.constraints !== undefined) patch.constraints = str(body.constraints) || undefined;
    if (body.hoursPerWeek !== undefined) patch.hoursPerWeek = num(body.hoursPerWeek);
    const updated = updatePath(id, patch);
    if (!updated) return NextResponse.json({ error: "No such path." }, { status: 404 });
    return NextResponse.json({ path: updated });
  }

  if (action === "deletePath") {
    const removed = removePath(str(body.id));
    if (!removed) return NextResponse.json({ error: "No such path." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // ─── Nodes ────────────────────────────────────────────────────────────────

  if (action === "addNode") {
    const title = str(body.title);
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

    const parentId = body.parentId ? str(body.parentId) : null;
    const parent = parentId ? getPathNode(parentId) : null;
    if (parentId && !parent) return NextResponse.json({ error: "No such parent." }, { status: 404 });

    // A child inherits its path; a root node needs one named.
    const pathId = parent ? parent.pathId : str(body.pathId);
    if (!pathId || !getPath(pathId)) {
      return NextResponse.json({ error: "No such path." }, { status: 404 });
    }

    // Depth decides what a node is: children of the root and of ideas are work,
    // children of work are ideas. The client never has to get this right.
    const kind = parent?.kind === "work" ? "idea" : "work";
    const rawCategory = str(body.category);

    const node = addPathNode({
      pathId,
      parentId,
      kind,
      title,
      detail: str(body.detail) || undefined,
      rationale: str(body.rationale) || undefined,
      effort: str(body.effort) || undefined,
      category:
        kind === "work"
          ? CATEGORIES.includes(rawCategory as AnchorKind)
            ? (rawCategory as AnchorKind)
            : "ec"
          : undefined,
      hoursPerWeek: num(body.hoursPerWeek),
      years: num(body.years),
      origin: "you",
      status: kind === "work" ? "accepted" : "suggested",
    });
    return NextResponse.json({ node });
  }

  if (action === "setStatus") {
    const status = str(body.status);
    if (!STATUSES.includes(status as TangentStatus)) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }
    const updated = updatePathNode(str(body.id), { status: status as TangentStatus });
    if (!updated) return NextResponse.json({ error: "No such node." }, { status: 404 });
    return NextResponse.json({ node: updated });
  }

  if (action === "removeNode") {
    return NextResponse.json({ ok: true, removed: removePathNode(str(body.id)) });
  }

  if (action === "generate") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set, so Tangent can't draft branches yet." },
        { status: 503 }
      );
    }

    const parent = getPathNode(str(body.parentId));
    if (!parent) return NextResponse.json({ error: "No such node." }, { status: 404 });

    const owning = getPath(parent.pathId);
    if (!owning) return NextResponse.json({ error: "No such path." }, { status: 404 });

    const chain = pathAncestry(parent.id);
    const siblings = owning.nodes
      .filter((n) => n.parentId === parent.parentId && n.id !== parent.id)
      .map(nodeLine);

    const prompt = [
      pathBrief(owning.path),
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
          pathId: parent.pathId,
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
