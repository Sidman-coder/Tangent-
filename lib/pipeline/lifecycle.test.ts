// Run with `npm test` (Node's built-in runner; Node strips the types).
// A resolve hook adds ".ts" to the extensionless import, as in grade.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangeSetStatus } from "./changeset";
import type { CardAction } from "./lifecycle";

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

type Mod = typeof import("./lifecycle");

void (import("./lifecycle") as Promise<Mod>).then(({ nextStep }) => {
  const at = (status: ChangeSetStatus, action_id: string | null = null) => ({ status, action_id });
  const kind = (action: CardAction, status: ChangeSetStatus, action_id: string | null = null) => nextStep(action, at(status, action_id)).kind;

  test("confirm: a draft proceeds; a repeat answers with the first result", () => {
    assert.equal(kind("confirm", "draft"), "proceed");
    assert.equal(kind("confirm", "confirmed", "a1"), "already");
    assert.equal(kind("confirm", "discarded"), "refuse");
    assert.equal(kind("confirm", "undone", "a1"), "refuse");
  });

  test("discard: only a draft; a confirmed change points at Undo", () => {
    assert.equal(kind("discard", "draft"), "proceed");
    assert.equal(kind("discard", "discarded"), "already");
    const step = nextStep("discard", at("confirmed", "a1"));
    assert.equal(step.kind, "refuse");
    assert.match(step.kind === "refuse" ? step.message : "", /Undo/);
  });

  test("undo: needs a confirmed change with an undo entry", () => {
    assert.equal(kind("undo", "confirmed", "a1"), "proceed");
    assert.equal(kind("undo", "confirmed", null), "refuse"); // every task was a duplicate: nothing was added
    assert.equal(kind("undo", "undone", "a1"), "already");
    assert.equal(kind("undo", "draft"), "refuse");
    assert.equal(kind("undo", "discarded"), "refuse");
  });

  test("edit: drafts only", () => {
    assert.equal(kind("edit", "draft"), "proceed");
    for (const s of ["confirmed", "discarded", "undone"] as const) assert.equal(kind("edit", s, "a1"), "refuse");
  });

  test("shown: logged for drafts, otherwise a no-op", () => {
    assert.equal(kind("shown", "draft"), "proceed");
    for (const s of ["confirmed", "discarded", "undone"] as const) assert.equal(kind("shown", s), "already");
  });
});
