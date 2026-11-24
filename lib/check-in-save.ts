// Round 6 item 1: the check-in Save always says what happened. Pure, so the
// success and failure paths are tested without a browser
// (lib/check-in-save.test.ts); components/today/StepFollowUp.tsx shows them.

export type CheckInBody = {
  action: "check_in";
  taskId: string;
  feel: string | null;
  time: string | null;
  note?: string;
};

export type CheckInResult =
  /** Saved. `reply` is Tangent's note when there is one (distress, O2). */
  | { status: "saved"; reply: string | null }
  /** Not saved: a network error, a server error or `ok: false`. */
  | { status: "failed" };

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export async function saveCheckIn(fetchFn: FetchLike, body: CheckInBody): Promise<CheckInResult> {
  try {
    const res = await fetchFn("/api/today", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { status: "failed" };
    const data = (await res.json().catch(() => null)) as { ok?: boolean; reply?: string | null } | null;
    if (!data || data.ok === false) return { status: "failed" };
    return { status: "saved", reply: typeof data.reply === "string" && data.reply ? data.reply : null };
  } catch {
    return { status: "failed" };
  }
}

/** The line shown in place after a save: "Saved. Next: Wire the motor · Tue 7:30 PM". */
export function savedLine(next: string | null | undefined): string {
  return next ? `Saved. Next: ${next}` : "Saved.";
}

export const SAVE_FAILED = "That didn't save. Try again.";
/** How long the confirmation stays before the card closes itself. */
export const SAVED_MS = 2500;
