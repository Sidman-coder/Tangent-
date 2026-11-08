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

type Mod = typeof import("./schema-compat");
void (import("./schema-compat") as Promise<Mod>).then(({ schemaErrorKind, createColumnMemo }) => {
  test("Postgres and PostgREST codes for a missing column", () => {
    assert.equal(schemaErrorKind({ code: "42703", message: "x" }), "missing_column");
    assert.equal(schemaErrorKind({ code: "PGRST204", message: "x" }), "missing_column");
  });

  test("Postgres and PostgREST codes for a missing table", () => {
    assert.equal(schemaErrorKind({ code: "42P01", message: "x" }), "missing_table");
    assert.equal(schemaErrorKind({ code: "PGRST205", message: "x" }), "missing_table");
  });

  test("the message is enough when no code came through", () => {
    assert.equal(schemaErrorKind({ message: "column tasks.commitment_type does not exist" }), "missing_column");
    assert.equal(schemaErrorKind({ message: 'relation "public.context_slots" does not exist' }), "missing_table");
  });

  test("real failures aren't mistaken for a missing migration", () => {
    assert.equal(schemaErrorKind({ code: "23505", message: "duplicate key" }), null);
    assert.equal(schemaErrorKind({ code: "42501", message: "permission denied" }), null);
    assert.equal(schemaErrorKind(null), null);
    assert.equal(schemaErrorKind(undefined), null);
  });

  test("a missing column is remembered, then checked again", () => {
    const memo = createColumnMemo(60_000);
    assert.equal(memo.isMissing("commitment_type", 0), false);
    memo.markMissing("commitment_type", 0);
    assert.equal(memo.isMissing("commitment_type", 59_999), true);
    assert.equal(memo.isMissing("commitment_type", 60_000), false);
    assert.equal(memo.isMissing("commitment_type", 60_001), false);
  });
});
