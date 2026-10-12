// The reminder job can say the same thing several times ("Envelope Quotes due
// tomorrow" four times; "Two deadlines on Tuesday" / "Multiple deadlines
// Tuesday"). Until it stops at the source, the bell shows each reminder once:
// titles that share most of their meaningful words are the same reminder,
// and the newest one wins. Pure, so it's tested on its own.

const STOP = new Set(["a", "an", "the", "on", "in", "for", "of", "to", "and", "is", "are", "due", "your", "you", "this", "at"]);

function words(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/s$/, ""))
      .filter((w) => w && !STOP.has(w))
  );
}

function similar(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let shared = 0;
  a.forEach((w) => {
    if (b.has(w)) shared++;
  });
  return shared / Math.min(a.size, b.size) >= 0.6;
}

/** Newest first in, newest first out, one per reminder. Daily briefs are left
 *  alone. Each kept item lists the ids it stands for, so dismissing it can
 *  dismiss its hidden copies too. */
export function collapseDuplicates<T extends { id?: string; title: string; type?: string; timestamp: string }>(
  list: T[]
): (T & { duplicateIds: string[] })[] {
  const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const kept: { item: T & { duplicateIds: string[] }; key: Set<string> }[] = [];
  for (const item of sorted) {
    if (item.type === "daily_brief") {
      kept.push({ item: { ...item, duplicateIds: [] }, key: new Set() });
      continue;
    }
    const key = words(item.title);
    const twin = kept.find((k) => k.item.type === item.type && similar(k.key, key));
    if (twin) {
      if (item.id) twin.item.duplicateIds.push(item.id);
      continue;
    }
    kept.push({ item: { ...item, duplicateIds: [] }, key });
  }
  return kept.map((k) => k.item);
}
