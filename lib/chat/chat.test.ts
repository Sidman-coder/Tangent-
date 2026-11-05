// Run with `npm test`. Same resolve hook as lib/context/context.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

type Scope = typeof import("./scope");
type Context = typeof import("./context");
type Library = typeof import("./library");

void Promise.all([import("./scope") as Promise<Scope>, import("./context") as Promise<Context>, import("./library") as Promise<Library>]).then(
  ([scopeM, contextM, libraryM]) => {
const { scopeOfSession, canContinueGeneral, shouldSummarize, parseScope, sameScope } = scopeM;
const { estimateTokens, formatChatContext, CHAT_CONTEXT_TOKEN_BUDGET } = contextM;
const { libraryEntries, filterLibrary } = libraryM;
type ChatSession = import("../types").ChatSession;
type Task = import("../types").Task;
type Plan = import("../types").Plan;

const T1 = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-222222222222";

const session = (over: Partial<ChatSession>): ChatSession => ({
  id: "s",
  title: "Chat",
  messages: [{ role: "user", content: "hi", timestamp: "2026-11-05T10:00:00Z" }],
  createdAt: "2026-11-05T10:00:00Z",
  updatedAt: "2026-11-05T10:00:00Z",
  ...over,
});

// ── scope ────────────────────────────────────────────────────────────────────

test("scopeOfSession reads the scope column after the migration", () => {
  assert.deepEqual(scopeOfSession({ scope: "task", taskId: T1, planId: P1 }), { type: "task", taskId: T1 });
  assert.deepEqual(scopeOfSession({ scope: "project", planId: P1 }), { type: "project", projectId: P1 });
  assert.deepEqual(scopeOfSession({ scope: "general", planId: P1, taskIds: [T1] }), { type: "general" });
});

test("scopeOfSession infers before the migration", () => {
  assert.deepEqual(scopeOfSession({ planId: P1, taskIds: [T1] }), { type: "project", projectId: P1 });
  assert.deepEqual(scopeOfSession({ taskIds: [T1] }), { type: "task", taskId: T1 });
  assert.deepEqual(scopeOfSession({ taskIds: [T1, P1] }), { type: "general" });
  assert.deepEqual(scopeOfSession({}), { type: "general" });
  // A task scope without its task falls back to inference.
  assert.deepEqual(scopeOfSession({ scope: "task", taskId: null }), { type: "general" });
});

test("parseScope accepts only well-formed scopes", () => {
  assert.deepEqual(parseScope({ type: "general" }), { type: "general" });
  assert.deepEqual(parseScope({ type: "task", taskId: T1 }), { type: "task", taskId: T1 });
  assert.equal(parseScope({ type: "task", taskId: "nope" }), null);
  assert.equal(parseScope({ type: "project" }), null);
  assert.equal(parseScope("general"), null);
  assert.ok(sameScope({ type: "task", taskId: T1 }, { type: "task", taskId: T1 }));
  assert.ok(!sameScope({ type: "task", taskId: T1 }, { type: "project", projectId: T1 }));
});

test("canContinueGeneral: within 2 hours only", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  assert.equal(canContinueGeneral("2026-11-05T10:30:00Z", now), true);
  assert.equal(canContinueGeneral("2026-11-05T10:00:00Z", now), false);
  assert.equal(canContinueGeneral(null, now), false);
  assert.equal(canContinueGeneral("not a date", now), false);
  assert.equal(canContinueGeneral("2026-11-06T12:00:00Z", now), false);
});

test("shouldSummarize every 6 messages", () => {
  assert.equal(shouldSummarize(5, 0), false);
  assert.equal(shouldSummarize(6, 0), true);
  assert.equal(shouldSummarize(9, 6), false);
  assert.equal(shouldSummarize(12, 6), true);
});

// ── context ──────────────────────────────────────────────────────────────────

test("estimateTokens is chars / 4", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
});

test("formatChatContext: task note, then notes and summary", () => {
  const out = formatChatContext({ scope: "task", title: "Read ch. 12", when: "2026-11-07 at 16:00", notes: "pages 300-340", summary: "We split it in two." });
  assert.match(out, /this one task: "Read ch. 12", 2026-11-07 at 16:00/);
  assert.match(out, /Notes: pages 300-340/);
  assert.match(out, /Earlier in this chat: We split it in two\./);
});

test("formatChatContext: general with nothing to say is empty", () => {
  assert.equal(formatChatContext({ scope: "general" }), "");
  assert.match(formatChatContext({ scope: "general", summary: "Talked about SAT." }), /SAT/);
});

test("formatChatContext stays inside the budget, open steps first", () => {
  const steps = Array.from({ length: 400 }, (_, i) => ({ title: `Step number ${i} with a fairly long title`, date: `2026-12-${String((i % 28) + 1).padStart(2, "0")}`, done: i % 2 === 0 }));
  const out = formatChatContext({ scope: "project", title: "SAT prep", goal: "1500+", steps });
  assert.ok(estimateTokens(out) <= CHAT_CONTEXT_TOKEN_BUDGET, `got ${estimateTokens(out)} tokens`);
  assert.match(out, /project "SAT prep"/);
  assert.match(out, /…and \d+ more/);
  const firstStep = out.split("\n").find((l) => l.startsWith("- "));
  assert.ok(firstStep && !firstStep.includes("[done]"), "open steps come first");
  const small = formatChatContext({ scope: "project", title: "SAT prep", steps }, 100);
  assert.ok(estimateTokens(small) <= 100);
});

test("formatChatContext: a project with no steps says so", () => {
  assert.match(formatChatContext({ scope: "project", title: "Essay" }), /none yet/);
});

// ── library ──────────────────────────────────────────────────────────────────

const task = { id: T1, title: "Read ch. 12", date: "2026-11-07", time: "16:00", completed: false } as Task;
const plan = { id: P1, title: "SAT prep", description: "", taskIds: [], color: "teal", createdAt: "", taskCount: 3 } as Plan;

test("libraryEntries: scope, title, color and where it opens", () => {
  const entries = libraryEntries(
    [
      session({ id: "g", title: "General", updatedAt: "2026-11-03T10:00:00Z" }),
      session({ id: "p", title: "old", planId: P1, updatedAt: "2026-11-05T10:00:00Z" }),
      session({ id: "t", title: "old", scope: "task", taskId: T1, updatedAt: "2026-11-04T10:00:00Z" }),
      session({ id: "empty", messages: [] }),
    ],
    [task],
    [plan]
  );
  assert.deepEqual(entries.map((e) => e.id), ["p", "t", "g"]);
  assert.equal(entries[0].title, "SAT prep");
  assert.equal(entries[0].color, "teal");
  assert.equal(entries[0].href, `/projects/${P1}?chat=1`);
  assert.equal(entries[1].href, null);
  assert.equal(entries[1].taskId, T1);
  assert.equal(entries[2].href, "/?chat=g");
});

test("libraryEntries: orphans open read-only on Home", () => {
  const [e] = libraryEntries([session({ id: "x", title: "Gone", scope: "task", taskId: T1 })], [], []);
  assert.equal(e.orphan, true);
  assert.equal(e.href, "/?chat=x");
  assert.equal(e.color, "neutral");
});

test("libraryEntries: preview drops saved cards and prefers the summary", () => {
  const [a] = libraryEntries(
    [session({ messages: [{ role: "assistant", content: "Two questions.\n\n<!-- tangent:card %7B%7D -->", timestamp: "" }] })],
    [],
    []
  );
  assert.equal(a.preview, "Two questions.");
  const [b] = libraryEntries([session({ summary: "Planned three weeks." })], [], []);
  assert.equal(b.preview, "Planned three weeks.");
});

test("filterLibrary by tab and query", () => {
  const entries = libraryEntries(
    [session({ id: "g", title: "Weekend" }), session({ id: "p", planId: P1 }), session({ id: "t", scope: "task", taskId: T1 })],
    [task],
    [plan]
  );
  assert.deepEqual(filterLibrary(entries, "projects", "").map((e) => e.id), ["p"]);
  assert.deepEqual(filterLibrary(entries, "tasks", "").map((e) => e.id), ["t"]);
  assert.deepEqual(filterLibrary(entries, "general", "").map((e) => e.id), ["g"]);
  assert.deepEqual(filterLibrary(entries, "all", "sat").map((e) => e.id), ["p"]);
  assert.deepEqual(filterLibrary(entries, "all", "  ").length, 3);
});
  }
);
