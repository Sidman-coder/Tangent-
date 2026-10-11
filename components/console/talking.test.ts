// Run with `npm test`. A4: plan → "Just talking" → answer → "Ready to add
// this to your calendar?". talking.ts imports "@/lib/pipeline/…"; the resolve
// hook maps "@/" to the project root and adds ".ts".
import * as nodeModule from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(ROOT, s.slice(2))).href;
    if ((s.startsWith(".") || s.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(s)) {
      try {
        return next(`${s}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(s, context);
  },
});

type Mod = typeof import("./talking");

void (import("./talking") as Promise<Mod>).then(({ talkingRoute, isReadyReply, openPlanTurn }) => {
  type T = { id: string; talking?: boolean; planReady?: boolean; planClosed?: boolean };
  const SCHEDULE = "Here's your week:\nMon, Oct 12 — 4:00 PM — Outline\nWed, Oct 14 — 4:00 PM — Draft\nFri, Oct 16 — 4:00 PM — Edit";

  test("plan → Just talking → answer → readiness shown", () => {
    // 1. "help me plan my essay" drafted a preview; 2. "Just talking" turned
    // it into a chat reply that asks one question.
    const turns: T[] = [{ id: "t1", talking: true }];
    // 3. The answer is talked through, not drafted.
    assert.equal(talkingRoute(turns, "I'm free after 4 most days"), "chat");
    // 4. The reply is a complete schedule: the readiness row and the chip.
    assert.equal(isReadyReply("plan_reply", SCHEDULE), true);
    turns.push({ id: "t2", talking: true, planReady: isReadyReply("plan_reply", SCHEDULE) });
    assert.equal(openPlanTurn(turns)?.id, "t2");
  });

  test("a reply still asking a question isn't ready", () => {
    assert.equal(isReadyReply("chat_reply", "When is it due?"), false);
    assert.equal(isReadyReply("plan_reply", `${SCHEDULE}\nDoes that work?`), false);
  });

  test("asking to act leaves talking: commands and 'add this plan' go to the intake", () => {
    const turns: T[] = [{ id: "t1", talking: true }];
    assert.equal(talkingRoute(turns, "add soccer practice tomorrow at 5"), undefined);
    assert.equal(talkingRoute(turns, "add this plan to my calendar"), undefined);
    assert.equal(talkingRoute(turns, "yes add it"), undefined);
    // Not talking: nothing changes.
    assert.equal(talkingRoute([{ id: "t0" }], "I'm free after 4"), undefined);
    assert.equal(talkingRoute([], "hi"), undefined);
  });

  test("the chip stays through Keep talking and goes once added or dismissed", () => {
    const turns: T[] = [{ id: "t1", planReady: true }, { id: "t2", talking: true }];
    assert.equal(openPlanTurn(turns)?.id, "t1");
    turns[0].planClosed = true;
    assert.equal(openPlanTurn(turns), null);
    // A newer schedule replaces an older one.
    turns.push({ id: "t3", planReady: true });
    assert.equal(openPlanTurn(turns)?.id, "t3");
  });
});
