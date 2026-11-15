// Round 5A 2.5: "Plan this" from somewhere other than Home (/capture) opens
// Home's planning view and carries the talk over. The talk goes through
// sessionStorage, never the URL (it's the student's own words); Home reads it
// once on /?plan=1. Separate from lib/ask-handoff.ts's `tangent-ask-*` keys.

export const TALK_HANDOFF_KEY = "tangent:talk-handoff";

export type TalkHandoff = {
  /** The talk so far, oldest first. */
  lines: { role: "user" | "assistant"; text: string }[];
  /** The goal to plan. */
  goal: string;
};

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function putTalkHandoff(handoff: TalkHandoff, s: Storage | null = store()): void {
  try {
    s?.setItem(TALK_HANDOFF_KEY, JSON.stringify({ lines: handoff.lines.slice(-12), goal: handoff.goal.slice(0, 2000) }));
  } catch {
    /* storage blocked: Home plans the goal without the talk */
  }
}

/** Read once: the handoff is removed as it's read. */
export function takeTalkHandoff(s: Storage | null = store()): TalkHandoff | null {
  try {
    const raw = s?.getItem(TALK_HANDOFF_KEY);
    s?.removeItem(TALK_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TalkHandoff>;
    const goal = typeof parsed.goal === "string" ? parsed.goal.trim() : "";
    if (!goal) return null;
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .filter((l): l is TalkHandoff["lines"][number] => !!l && (l.role === "user" || l.role === "assistant") && typeof l.text === "string" && !!l.text.trim())
          .slice(-12)
      : [];
    return { lines, goal };
  } catch {
    return null;
  }
}
