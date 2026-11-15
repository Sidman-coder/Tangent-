import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { GuardConfig, GuardContext } from "./plan-guard";

type Mod = typeof import("./plan-guard");

void (import("./plan-guard.ts" as string) as Promise<Mod>).then(({ checkStep, dropNote, isGenericTitle, topicWords }) => {

const cfg = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "config", "plan-guard.json"), "utf8")) as GuardConfig;

const ctx: GuardContext = {
  factIds: ["f1", "f2"],
  dates: ["2026-11-16", "2026-11-17"],
  topicText: "help me get better at competitive programming for USACO silver",
};

const good = {
  what: "Solve 3 USACO Bronze prefix-sum problems",
  why: "You said Tuesdays are light after soccer, so this gets the longer block.",
  why_ref: { kind: "fact" as const, ref: "f1" },
};

test("plan-guard: a specific step tied to a real fact passes", () => {
  assert.deepEqual(checkStep(good, ctx, cfg), { ok: true });
});

test("plan-guard: banned boilerplate in the reason fails", () => {
  const r = checkStep({ ...good, why: "You're aiming for a top result, so stay consistent every day." }, ctx, cfg);
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.reason, "banned_phrase");
});

test("plan-guard: a title of only generic words fails", () => {
  assert.equal(isGenericTitle("Practice problems", cfg), true);
  assert.equal(isGenericTitle("Study session 2", cfg), true);
  assert.equal(isGenericTitle("Solve 3 USACO prefix-sum problems", cfg), false);
  const r = checkStep({ ...good, what: "Practice problems" }, ctx, cfg);
  assert.equal(!r.ok && r.reason, "generic_title");
});

test("plan-guard: a too-short reason fails", () => {
  const r = checkStep({ ...good, why: "Good practice." }, ctx, cfg);
  assert.equal(!r.ok && r.reason, "short_why");
});

test("plan-guard: refs must point at something real", () => {
  assert.equal((r => !r.ok && r.reason)(checkStep({ ...good, why_ref: { kind: "fact", ref: "f9" } }, ctx, cfg)), "unknown_fact");
  assert.equal((r => !r.ok && r.reason)(checkStep({ ...good, why_ref: null }, ctx, cfg)), "no_ref");
  assert.equal((r => !r.ok && r.reason)(checkStep({ ...good, why_ref: { kind: "calendar", ref: "2026-12-01" } }, ctx, cfg)), "unknown_date");
  assert.deepEqual(checkStep({ ...good, why_ref: { kind: "calendar", ref: "2026-11-17" } }, ctx, cfg), { ok: true });
  assert.equal((r => !r.ok && r.reason)(checkStep({ ...good, why_ref: { kind: "topic", ref: "chemistry titration" } }, ctx, cfg)), "off_topic");
  assert.deepEqual(checkStep({ ...good, why_ref: { kind: "topic", ref: "USACO silver contest" } }, ctx, cfg), { ok: true });
});

test("plan-guard: topic words drop filler and fold plurals", () => {
  assert.deepEqual(topicWords("Help me get better at the problems"), ["problem"]);
});

test("plan-guard: drop note wording", () => {
  assert.equal(dropNote(0), "");
  assert.match(dropNote(1), /one step/);
  assert.match(dropNote(2), /2 steps/);
});
});
