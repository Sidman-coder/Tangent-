// Run with `npm test`. The sidebar's Projects list: projects and Tangents, the
// most recently opened first (newest-created for anything never opened).
import { test } from "node:test";
import assert from "node:assert/strict";
// Node's native TypeScript runner needs the extension to resolve this module.
// @ts-expect-error Next's no-emit configuration omits allowImportingTsExtensions.
import { recentProjectsAndTangents } from "./sidebar-recents.ts";

const plan = (id: string, createdAt: string, lastOpenedAt?: string) => ({ id, title: `Plan ${id}`, createdAt, lastOpenedAt });
const path = (id: string, createdAt: string, lastOpenedAt?: string) => ({ id, title: `Path ${id}`, createdAt, lastOpenedAt });

test("projects and Tangents mix, newest first", () => {
  const list = recentProjectsAndTangents(
    [plan("a", "2026-11-01T10:00:00Z"), plan("b", "2026-11-05T10:00:00Z")],
    [path("x", "2026-11-03T10:00:00Z")],
  );
  assert.deepEqual(
    list.map((r) => `${r.kind}:${r.id}`),
    ["project:b", "tangent:x", "project:a"],
  );
});

test("only the newest seven", () => {
  const plans = Array.from({ length: 6 }, (_, i) => plan(`p${i}`, `2026-11-0${i + 1}T10:00:00Z`));
  const paths = Array.from({ length: 3 }, (_, i) => path(`t${i}`, `2026-10-2${i}T10:00:00Z`));
  const list = recentProjectsAndTangents(plans, paths);
  assert.equal(list.length, 7);
  assert.deepEqual(
    list.map((r) => r.id),
    ["p5", "p4", "p3", "p2", "p1", "p0", "t2"],
  );
});

test("a missing or bad date sorts last instead of breaking the list", () => {
  const list = recentProjectsAndTangents([plan("a", ""), plan("b", "2026-11-05T10:00:00Z")], [path("x", "not a date")]);
  assert.equal(list[0].id, "b");
  assert.equal(list.length, 3);
});

test("nothing yet gives an empty list", () => {
  assert.deepEqual(recentProjectsAndTangents([], []), []);
  assert.deepEqual(recentProjectsAndTangents(undefined, null), []);
});

test("the one you opened last comes first, even if it's old", () => {
  const list = recentProjectsAndTangents(
    [plan("old", "2026-09-01T10:00:00Z", "2026-11-14T08:00:00Z"), plan("new", "2026-11-10T10:00:00Z")],
    [path("t", "2026-10-01T10:00:00Z", "2026-11-13T08:00:00Z")],
  );
  assert.deepEqual(
    list.map((r) => r.id),
    ["old", "t", "new"],
  );
});

test("an open the server hasn't confirmed yet counts right away", () => {
  const list = recentProjectsAndTangents(
    [plan("a", "2026-11-10T10:00:00Z"), plan("b", "2026-11-01T10:00:00Z")],
    [path("t", "2026-11-05T10:00:00Z")],
    { "tangent:t": "2026-11-14T12:00:00Z" },
  );
  assert.deepEqual(
    list.map((r) => r.id),
    ["t", "a", "b"],
  );
});

test("seven of your usual ones beat a pile of new ones you never opened", () => {
  const usual = Array.from({ length: 7 }, (_, i) => plan(`u${i}`, "2026-09-01T10:00:00Z", `2026-11-1${i}T10:00:00Z`));
  const fresh = Array.from({ length: 5 }, (_, i) => plan(`f${i}`, `2026-11-0${i + 1}T10:00:00Z`));
  const list = recentProjectsAndTangents([...usual, ...fresh], []);
  assert.ok(list.every((r) => r.id.startsWith("u")));
});
