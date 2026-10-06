// Small display helpers shared by the Tangents field and a path's own page.

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });

/** A deadline as a person would say it. The intake takes free text ("end of
 *  next summer") or a date; only an ISO date gets reformatted, so free text is
 *  never mangled into something the person did not write. */
export function formatDeadline(deadline: string | undefined): string | null {
  const text = deadline?.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!Number.isNaN(date.getTime())) return `By ${MONTH_YEAR.format(date)}`;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "By Nov 2027 · 6 h a week", or whichever half exists. */
export function pathMeta(path: { deadline?: string; hoursPerWeek?: number }): string | null {
  const parts = [
    formatDeadline(path.deadline),
    path.hoursPerWeek ? `${path.hoursPerWeek} h a week` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Drafted branches store "summary\n\nFirst step: ..." in a node's detail.
 *  The one place that reads that format back. */
export function splitNodeDetail(detail: string | undefined): { summary: string; firstStep: string } {
  const [summary = "", firstStep = ""] = (detail ?? "").split(/\n\nFirst step:\s*/);
  return { summary: summary.trim(), firstStep: firstStep.trim() };
}

/** A first step shortened to fit as a task title: whole words, no trailing
 *  punctuation, an ellipsis only when something was cut. */
export function stepTitle(text: string, max = 60): string {
  const t = text.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  const words = space >= max * 0.6 ? cut.slice(0, space) : cut;
  return `${words.replace(/[\s,;:.–-]+$/, "")}…`;
}
