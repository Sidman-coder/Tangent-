import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  addPathNode,
  addPathNodes,
  clearSuggestions,
  createPath,
  getPath,
  getPathNode,
  getPathSpace,
  getUserTimezone,
  pathAncestry,
  removePath,
  removePathNode,
  updatePath,
  updatePathNode,
} from "@/lib/store";
import type { AnchorKind, Path, PathGoalKind, PathNode, TangentStatus } from "@/lib/types";
import { withUser } from "@/lib/request-context";
import { callClaude, messageText } from "@/lib/ai/call";
import { getUserToday } from "@/lib/time";

export const dynamic = "force-dynamic";
// Claude drafts three branches per node.
export const maxDuration = 60;

const CATEGORIES: AnchorKind[] = ["ec", "award", "course", "project"];
const STATUSES: TangentStatus[] = ["suggested", "accepted", "done", "dismissed"];
const KINDS: PathGoalKind[] = ["college", "career", "skill", "other"];

/** Three branches, never more. The panel shows one node at a time, and a wall of
 *  options is the opposite of a next step.
 *
 *  The title rides on a card on the drawing, so it is short; the substance is
 *  in the summary, the reason and the first step, which the inspector shows
 *  when the card is opened. Length limits live in the descriptions and are
 *  enforced by trimming on our side: schema length constraints are not sent to
 *  the API and would fail the parse client-side instead. */
const BranchSchema = z.object({
  branches: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            "A short label for the card on the drawing: 2 to 6 words, starting with a verb, no punctuation at the end. e.g. \"Enter a rated tournament\"."
          ),
        summary: z
          .string()
          .describe("One or two plain sentences: exactly what to do, specific enough to start without asking anything else."),
        why: z
          .string()
          .describe("One sentence: how this moves them from where they are now toward the goal, and what it adds that the thing it branches from does not."),
        first_step: z
          .string()
          .describe("One thing they can do this week in under an hour to start it."),
        effort: z.string().describe('The shape of the commitment, e.g. "2 hrs a week for 6 weeks" or "one weekend".'),
        hours_per_week: z.number().describe("Average hours a week this takes while it runs. 0 for a one-off."),
      })
    )
    .min(1),
});

/** Sent as output_config.format. Array length limits are not supported by
 *  structured outputs, so "exactly three" is in the prompt and enforced by
 *  slicing on our side. */
const { $schema: _draft, ...branchJsonSchema } = z.toJSONSchema(
  BranchSchema.extend({ branches: BranchSchema.shape.branches.element.array() }),
  { target: "draft-7" }
);
const BRANCH_FORMAT = { type: "json_schema", schema: branchJsonSchema } as Anthropic.JSONOutputFormat;

/** What each kind of goal is actually judged on. Branches are aimed at that,
 *  not at looking busy. */
const KIND_LENS: Record<PathGoalKind, string> = {
  college:
    "This is an admission goal. What moves a reader is depth over breadth, real impact on other people, leadership that produced something, and a clear line from their activities to the major they are applying for. Programmes that mainly cost money carry little weight; prefer things that make them visibly better at what they already do.",
  career:
    "This is a hiring goal. What moves a hiring manager is shipped work they can look at, skills shown rather than claimed, and someone who can vouch for them. Favour branches that produce an artifact, a reference, or a direct conversation with someone in the field.",
  skill:
    "This is a measured-skill goal. What moves the number is deliberate practice on specific weaknesses, fast feedback, and performing in the setting where the measure is taken (rated events, graded exams, testing). Favour branches that find and fix weaknesses over branches that just add volume.",
  other:
    "Work backward from the stated finish line: favour branches that produce a visible piece of the finished thing, or remove what is blocking it, over preparation for its own sake.",
};

/** What the intake is for: every branch is judged against these facts. */
const SYSTEM = `You help a student extend what they are already doing toward a goal they have stated.

The goal can be anything with a target you could verify: a university place, a job,
a rating, a certification, a body of work. Never assume it is about college unless it is.

You are given the goal, where they are now, today's date and their deadline, the hours a
week they can give it and how many of those are already committed, what is in their way,
everything already on their path, and the chain leading down to the one item they want to
branch off now. Propose exactly three branches off the last item in that chain.

Rules:
- Branch off what they already have. Each branch must grow directly out of that item; never propose something unrelated to it.
- Each branch is a concrete action, not a theme. "Ask the coach to let you run CAD for regionals", not "develop leadership skills".
- Respect the hours and the constraints. If the remaining hours are small, propose small branches. A branch they cannot afford, reach, or fit is a wasted branch.
- Respect the deadline. Do not propose anything that cannot pay off before it.
- Do not repeat or lightly reword anything already on their path.
- Vary the angle across the three: one that deepens the item, one that widens who sees its results, one that connects it to something else they already do.
- The deeper the chain, the more specific you get. A branch off a branch is a next step, not a restatement.
- Write to them as "you", in plain words a high-school student would use. No preamble, no flattery, no jargon.
- Never claim a branch guarantees the goal, and never invent facts about specific programmes, deadlines or prices you are not sure of.`;

function nodeLine(n: PathNode): string {
  const bits = [n.title];
  if (n.detail) bits.push(n.detail);
  if (n.effort) bits.push(n.effort);
  if (n.hoursPerWeek) bits.push(`${n.hoursPerWeek} hrs/wk`);
  if (n.years) bits.push(`${n.years} year${n.years === 1 ? "" : "s"}`);
  return bits.join(" - ");
}

function pathBrief(path: Path, committedHours: number, today: string): string {
  return [
    `Goal: ${path.target || path.title}`,
    `Kind of goal: ${path.kind}`,
    KIND_LENS[path.kind] ?? KIND_LENS.other,
    path.current ? `Where they are now: ${path.current}` : "Where they are now: not stated",
    `Today: ${today}`,
    path.deadline ? `Deadline: ${path.deadline}` : "Deadline: none stated",
    path.hoursPerWeek
      ? `Hours a week available: ${path.hoursPerWeek}, of which about ${committedHours} are already committed to kept branches`
      : "Hours a week available: not stated; keep branches modest",
    path.constraints ? `In the way: ${path.constraints}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function clipText(text: string, max: number): string {
  const t = text.trim().replace(/[.\s]+$/, "");
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export const GET = withUser(async (req: Request) => {
  const pathId = new URL(req.url).searchParams.get("pathId");
  if (!pathId) {
    // The gallery only needs each Path plus how much has grown in it.
    const { paths, nodes } = await getPathSpace();
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

  const found = await getPath(pathId);
  if (!found) return NextResponse.json({ error: "No such path." }, { status: 404 });
  return NextResponse.json(found);
});

export const POST = withUser(async (req: Request) => {
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
    const path = await createPath({
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
    // One per line when they used lines ("Robotics club, programming lead"
    // stays one item); commas and semicolons only when it is all on one line.
    const standing = str(body.standing);
    const seeds = standing
      .split(standing.includes("\n") ? /\n+/ : /[,;]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);
    const created = await addPathNodes(
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
    const updated = await updatePath(id, patch);
    if (!updated) return NextResponse.json({ error: "No such path." }, { status: 404 });
    return NextResponse.json({ path: updated });
  }

  if (action === "deletePath") {
    const removed = await removePath(str(body.id));
    if (!removed) return NextResponse.json({ error: "No such path." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  // ─── Nodes ────────────────────────────────────────────────────────────────

  if (action === "addNode") {
    const title = str(body.title);
    if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });

    const parentId = body.parentId ? str(body.parentId) : null;
    const parent = parentId ? await getPathNode(parentId) : null;
    if (parentId && !parent) return NextResponse.json({ error: "No such parent." }, { status: 404 });

    // A child inherits its path; a root node needs one named.
    const pathId = parent ? parent.pathId : str(body.pathId);
    if (!pathId || !(await getPath(pathId))) {
      return NextResponse.json({ error: "No such path." }, { status: 404 });
    }

    // Depth decides what a node is: children of the root and of ideas are work,
    // children of work are ideas. The client never has to get this right.
    const kind = parent?.kind === "work" ? "idea" : "work";
    const rawCategory = str(body.category);

    const node = await addPathNode({
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
    const updated = await updatePathNode(str(body.id), { status: status as TangentStatus });
    if (!updated) return NextResponse.json({ error: "No such node." }, { status: 404 });
    return NextResponse.json({ node: updated });
  }

  if (action === "removeNode") {
    return NextResponse.json({ ok: true, removed: await removePathNode(str(body.id)) });
  }

  if (action === "generate") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not set, so Tangent can't draft branches yet." },
        { status: 503 }
      );
    }

    const parent = await getPathNode(str(body.parentId));
    if (!parent) return NextResponse.json({ error: "No such node." }, { status: 404 });

    const owning = await getPath(parent.pathId);
    if (!owning) return NextResponse.json({ error: "No such path." }, { status: 404 });

    const chain = await pathAncestry(parent.id);
    const chainIds = new Set(chain.map((n) => n.id));
    // Everything else on the path, grouped under what it hangs off, so the
    // model can avoid repeats and see what it could connect to. Suggestions
    // still waiting on a decision about this same item are about to be
    // replaced, so they are left out.
    const others = owning.nodes.filter(
      (n) => !chainIds.has(n.id) && n.status !== "dismissed" && !(n.parentId === parent.id && n.status === "suggested")
    );
    const byParent = new Map<string | null, PathNode[]>();
    for (const n of others) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n]);
    const outline: string[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const n of byParent.get(parentId) ?? []) {
        outline.push(`${"  ".repeat(depth)}- ${nodeLine(n)} [${n.kind}, ${n.status}]`);
        walk(n.id, depth + 1);
      }
    };
    walk(null, 0);
    for (const n of chain) walk(n.id, 1);

    const committedHours = owning.nodes
      .filter((n) => n.status === "accepted" && n.kind === "idea")
      .reduce((sum, n) => sum + (n.hoursPerWeek ?? 0), 0);

    const prompt = [
      pathBrief(owning.path, committedHours, getUserToday(await getUserTimezone())),
      `The chain down to what they want to branch off now:\n${chain
        .map((n, i) => `${"  ".repeat(i)}${i + 1}. ${nodeLine(n)}`)
        .join("\n")}`,
      outline.length
        ? `Already on their path (do not repeat these; connect to them where it helps):\n${outline.join("\n")}`
        : "Nothing else is on their path yet.",
    ].join("\n\n");

    // Cost-tracked like every other Claude call: model tier, daily budget and
    // ai_usage telemetry come from callClaude (lib/ai/call.ts).
    const r = await callClaude(
      "pathBranches",
      { system: SYSTEM, messages: [{ role: "user", content: prompt }] },
      { format: BRANCH_FORMAT, label: "path branches" }
    );
    if (!r.ok) {
      console.error("[api/path] generate failed:", r.status, r.error);
      if (r.budgetExceeded) return NextResponse.json({ error: r.error }, { status: 429 });
      // Most specific first: busy is worth retrying in a moment, a bad key or
      // request is not.
      if (r.status === 429 || r.status === 529) {
        return NextResponse.json({ error: "Tangent is busy right now. Try again in a minute." }, { status: 429 });
      }
      if (r.status === 401 || r.status === 403) {
        return NextResponse.json({ error: "Tangent's AI key isn't working. Check ANTHROPIC_API_KEY." }, { status: 503 });
      }
      if (r.status === 0) {
        return NextResponse.json({ error: "Tangent couldn't reach Claude just now." }, { status: 502 });
      }
      return NextResponse.json({ error: "Tangent couldn't draft branches this time." }, { status: 502 });
    }

    if (r.message.stop_reason === "refusal") {
      return NextResponse.json({ error: "Tangent can't draft branches for this one." }, { status: 422 });
    }
    let parsed: z.infer<typeof BranchSchema> | null = null;
    try {
      const result = BranchSchema.safeParse(JSON.parse(messageText(r.message)));
      if (result.success) parsed = result.data;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      return NextResponse.json({ error: "Tangent couldn't draft branches this time." }, { status: 502 });
    }

    await clearSuggestions(parent.id);
    const kind = parent.kind === "work" ? "idea" : "work";
    const created = await addPathNodes(
      parsed.branches.slice(0, 3).map((b) => ({
        pathId: parent.pathId,
        parentId: parent.id,
        kind,
        // Short enough for the card; the substance is in the inspector.
        title: clipText(b.title, 48),
        detail: `${b.summary.trim()}

First step: ${b.first_step.trim()}`,
        rationale: b.why.trim(),
        effort: b.effort.trim(),
        ...(b.hours_per_week > 0 ? { hoursPerWeek: Math.round(b.hours_per_week * 10) / 10 } : {}),
        origin: "tangent" as const,
        status: "suggested" as const,
      }))
    );
    return NextResponse.json({ nodes: created });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
});
