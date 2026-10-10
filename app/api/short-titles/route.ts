import { NextResponse } from "next/server";
import { withUser } from "@/lib/request-context";
import { callClaude } from "@/lib/ai/call";
import { extractStructuredJson } from "@/lib/anthropic-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Calendar cells are narrow. This turns long task titles ("1.14a Les relations
// personnelles PBA Summative Assessment") into 2–5 word labels that still say
// what the thing is ("French PBA: relationships"). The browser caches every
// label (lib/short-titles.ts), so each title is shortened once.

const MAX_ITEMS = 60;

const SCHEMA = {
  type: "object",
  properties: {
    labels: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, label: { type: "string" } },
        required: ["id", "label"],
        additionalProperties: false,
      },
    },
  },
  required: ["labels"],
  additionalProperties: false,
} as const;

const SYSTEM = `You write calendar labels for a high school student's tasks. Each label must fit a narrow calendar cell, so it is 2 to 5 words and at most 32 characters, and still says exactly what the thing is.

- Keep what identifies it: the subject, the kind of work (quiz, test, essay, lab, reading, practice), and numbers that matter (chapter, unit, lesson).
- Drop course codes, section numbers that mean nothing alone (1.14a), teacher names, emojis, brackets, dates, times, and filler like "Assignment", "Submission", "Please complete".
- If the title is already short and clear, return it unchanged.
- Never invent details. Match the original language's meaning; translate other languages to English only if it makes the label clearer.

Examples:
"1.14a Les relations personnelles PBA Summative Assessment" → "French PBA: relationships"
"Envelope Quotes, Chapter 4 [English 10]" → "Envelope quotes ch. 4"
"Test continuity across pen circuits" → "Test pen circuits"
"Molarity POGIL [Super Chem 2026]" → "Molarity POGIL"
"Hold inaugural team kickoff meeting" → "Team kickoff meeting"`;

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as { items?: { id?: unknown; title?: unknown }[] };
  const items = (body.items ?? [])
    .filter((i): i is { id: string; title: string } => typeof i.id === "string" && typeof i.title === "string" && i.title.trim().length > 0)
    .slice(0, MAX_ITEMS)
    .map((i) => ({ id: i.id, title: i.title.slice(0, 200) }));
  if (items.length === 0) return NextResponse.json({ ok: true, labels: {} });

  const result = await callClaude(
    "shortTitles",
    {
      system: SYSTEM,
      messages: [{ role: "user", content: items.map((i) => `${i.id}\t${i.title}`).join("\n") }],
    },
    { format: { type: "json_schema", schema: SCHEMA } }
  );
  if (!result.ok) return NextResponse.json({ ok: false, error: "Couldn't shorten titles" }, { status: 502 });

  const labels: Record<string, string> = {};
  try {
    const parsed = extractStructuredJson<{ labels: { id: string; label: string }[] }>(result.message);
    const known = new Set(items.map((i) => i.id));
    for (const l of parsed.labels) {
      const label = l.label?.trim();
      if (known.has(l.id) && label && label.length <= 40) labels[l.id] = label;
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't read the labels" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, labels });
});
