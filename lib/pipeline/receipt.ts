// Master fix Phase 4: what a confirmed preview card says it did. A headline,
// two to four of the changes, and the full list grouped by week behind
// "See all". Pure (components/PreviewCard renders it).

import type { ChangeSet } from "./changeset";

export type ReceiptView = {
  headline: string;
  /** Shown straight away (at most 4). */
  lines: string[];
  /** Every change line; more than `lines` when "See all" is offered. */
  total: number;
  /** All the lines, by the week they fall in ("Other changes" when undated). */
  weeks: { label: string; lines: string[] }[];
};

const SHOWN = 4;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function weekOf(ymd: string): { key: string; label: string } {
  const [y, m, d] = ymd.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7)); // back to Monday
  const key = day.toISOString().slice(0, 10);
  return { key, label: `Week of ${day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}` };
}

/**
 * @param lines the preview's lines, one per op (describeChangeSet)
 * @param created tasks actually created (duplicates skipped), when known
 */
export function receiptView(cs: Pick<ChangeSet, "ops">, lines: readonly string[], created?: number): ReceiptView {
  const count = { add: 0, change: 0, complete: 0, del: 0, delPlan: 0 };
  const items: { line: string; date?: string }[] = [];
  let plan: string | null = null;
  cs.ops.forEach((op, i) => {
    const line = lines[i];
    if (op.op === "create_plan") {
      plan = op.title;
      return;
    }
    if (op.op === "add_task") count.add++;
    else if (op.op === "update_task" || op.op === "move_task" || op.op === "update_plan") count.change++;
    else if (op.op === "complete_task") count.complete++;
    else if (op.op === "delete_task") count.del++;
    else if (op.op === "delete_plan") count.delPlan++;
    if (!line) return;
    const date = "date" in op && typeof op.date === "string" ? op.date : undefined;
    items.push({ line, date });
  });

  const added = created !== undefined && created >= 0 ? Math.min(created, count.add) : count.add;
  const parts: string[] = [];
  if (plan) parts.push(`Added “${plan}” · ${plural(added, "session")}`);
  else if (count.add) parts.push(`Added ${plural(added, "task")}`);
  if (count.change) parts.push(`Changed ${plural(count.change, "item")}`);
  if (count.complete) parts.push(`Completed ${plural(count.complete, "task")}`);
  if (count.del) parts.push(`Deleted ${plural(count.del, "task")}`);
  if (count.delPlan) parts.push(`Removed ${plural(count.delPlan, "project")}`);
  const headline = parts.join(" · ") || "Saved to your calendar";

  const groups = new Map<string, { label: string; lines: string[] }>();
  for (const it of [...items].sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))) {
    const w = it.date && /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? weekOf(it.date) : { key: "~", label: "Other changes" };
    const g = groups.get(w.key) ?? { label: w.label, lines: [] };
    g.lines.push(it.line);
    groups.set(w.key, g);
  }

  return {
    headline,
    lines: items.length > SHOWN ? items.slice(0, SHOWN - 1).map((i) => i.line) : items.map((i) => i.line),
    total: items.length,
    weeks: Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g),
  };
}
