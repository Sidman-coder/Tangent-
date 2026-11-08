// Round 4 §3.2: a project has one chat thread; its history list splits that
// thread into the sittings it was written in, so earlier conversations are
// easy to find. Pure; relative imports for `node --test`.

/** A new sitting starts after this long without a message. */
export const SITTING_GAP_MS = 3 * 60 * 60 * 1000;

export type Sitting = { firstId: string; at: string; label: string; count: number };

type Dated = { id: string; at?: string; request: string };

/** Earlier sittings, oldest first, each named by its first request. Turns
 *  without a time join the sitting before them. */
export function sittings(turns: readonly Dated[]): Sitting[] {
  const out: Sitting[] = [];
  let last = Number.NaN;
  for (const t of turns) {
    const time = t.at ? Date.parse(t.at) : Number.NaN;
    const fresh = out.length === 0 || (Number.isFinite(time) && (!Number.isFinite(last) || time - last > SITTING_GAP_MS));
    if (fresh) {
      const label = t.request.replace(/\s+/g, " ").trim();
      out.push({ firstId: t.id, at: t.at ?? "", label: label.length > 60 ? `${label.slice(0, 59)}…` : label, count: 1 });
    } else {
      out[out.length - 1].count += 1;
    }
    if (Number.isFinite(time)) last = time;
  }
  return out;
}
