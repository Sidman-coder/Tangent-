// Run with `npm test`. Same resolve hook as ics.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});


type Mod = typeof import("./capture-outcome");
void (import("./capture-outcome") as Promise<Mod>).then(({ outcomeFromReply, outcomeFromError }) => {
  const day = (ymd: string) => `day(${ymd})`;

  test("a saved task says which day it landed on", () => {
    const o = outcomeFromReply({ ok: true, taskId: "t1", taskDate: "2026-10-27", message: "Added.", actionId: "a1" }, "chem test", day);
    assert.deepEqual(o, { kind: "saved", summary: "Added.", actionId: "a1", taskId: "t1", planId: null, where: "day(2026-10-27)" });
  });

  test("a new project says the project's name", () => {
    const o = outcomeFromReply({ ok: true, plan: { id: "p1", title: "Robotics intake" }, response: "Made a project." }, "robotics", day);
    assert.equal(o.kind, "saved");
    assert.equal(o.kind === "saved" && o.where, "Robotics intake");
    assert.equal(o.kind === "saved" && o.planId, "p1");
  });

  test("nowhere specific falls back to Your list, and markdown is stripped", () => {
    const o = outcomeFromReply({ ok: true, response: "**Done** for you" }, "x", day);
    assert.deepEqual(o.kind === "saved" && [o.where, o.summary], ["Your list", "Done for you"]);
  });

  test("a skipped duplicate reads as already on your list", () => {
    const o = outcomeFromReply({ ok: true, action: "add_task", response: 'Skipped 1 duplicate (already have "Lab" around 09:00).' }, "lab", day);
    assert.deepEqual(o, { kind: "duplicate", summary: "Already on your list" });
  });

  test("a change that needs confirming carries its id and message", () => {
    const o = outcomeFromReply({ ok: true, action: "confirm_required", pending: { id: "c1", message: "Delete 3 tasks?" } }, "clear friday", day);
    assert.deepEqual(o, { kind: "confirm", id: "c1", message: "Delete 3 tasks?" });
  });

  test("a failure keeps what was said so one tap can resend it", () => {
    assert.deepEqual(outcomeFromError("finish the deck"), { kind: "error", said: "finish the deck" });
  });
});
