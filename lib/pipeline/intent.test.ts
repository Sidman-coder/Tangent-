// Run with `npm test`. The intent router (B1) with a mocked model: it is never
// called with the flag off, fast paths skip it, bad answers fall back to the
// old rule, and low confidence becomes a clarify.
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

type Mod = typeof import("./intent");

void (import("./intent") as Promise<Mod>).then(
  ({ classifyIntent, routeFor, toChangeSetIntent, confidenceBucket, routerUserMessage, RouterOutputSchema, ROUTER_JSON_SCHEMA, ROUTER_INTENTS, MIN_CONFIDENCE, CLARIFY_OPTIONS }) => {
    const TZ = "America/New_York";
    const AT = new Date("2026-10-11T14:00:00Z");
    const TODAY = "2026-10-11";
    const PLANS = ["ICF Prep", "ICF Essay", "SAT Writing Skills Sprint"];

    const answer = (intent: string, confidence = 0.95, extra: Record<string, unknown> = {}) => ({
      intent,
      confidence,
      plan_mention: null,
      task_mention: null,
      clean_title: null,
      needs_questions: false,
      reason: "test",
      ...extra,
    });

    /** A mocked model that counts its calls and returns `reply`. */
    function mock(reply: unknown) {
      const calls: { system: string; user: string }[] = [];
      const caller = async (system: string, user: string) => {
        calls.push({ system, user });
        return typeof reply === "function" ? (reply as () => unknown)() : reply;
      };
      return { calls, caller };
    }
    const ctx = (caller: (s: string, u: string) => Promise<unknown>, flag = true) => ({ flag, tz: TZ, today: TODAY, planTitles: PLANS, caller, at: AT });

    test("flag off: the router is never called, the old rule decides", async () => {
      const m = mock(answer("new_plan"));
      for (const text of ["help me study for the SAT in 3 weeks", "what should I do for my ICF project?", "take out all of my SAT tasks", "add math hw tomorrow at 5pm", "should I schedule study time?"]) {
        const u = await classifyIntent(text, ctx(m.caller, false));
        assert.notEqual(u.via, "router", text);
      }
      assert.equal(m.calls.length, 0);
      const q = await classifyIntent("what should I do for my ICF project?", ctx(m.caller, false));
      assert.equal(q.route, "chat");
      assert.equal(q.fallback, "flag_off");
    });

    test("fast paths skip the model even with the flag on", async () => {
      const m = mock(answer("new_plan"));
      const u = await classifyIntent("I have a soccer coaching appointment coming up tomorrow 10pm", ctx(m.caller));
      assert.equal(u.route, "fast");
      assert.equal(u.via, "fast");
      assert.equal(m.calls.length, 0);
    });

    test("one model call; its answer decides the route", async () => {
      const cases: [string, string, string][] = [
        ["help me study for the SAT in 3 weeks", "new_plan", "draft"],
        ["start a robotics club", "new_project", "draft"],
        ["add a study session to my SAT plan", "add_to_plan", "draft"],
        ["rename my ICF plan to ICF Finals", "change_plan", "draft"],
        ["I have a test next week", "add_task", "draft"],
        ["take out all of my SAT tasks", "delete_plan_tasks", "draft"],
        ["should I schedule study time?", "question", "chat"],
        ["get into MIT", "tangent", "tangent"],
      ];
      for (const [text, intent, route] of cases) {
        const m = mock(answer(intent));
        const u = await classifyIntent(text, ctx(m.caller));
        assert.equal(m.calls.length, 1, text);
        assert.equal(u.via, "router", text);
        assert.equal(u.intent, intent, text);
        assert.equal(u.route, route, text);
      }
    });

    test("mentions and the clean title come through", async () => {
      const m = mock(answer("add_to_plan", 0.9, { plan_mention: "my eye see eff prep" }));
      const u = await classifyIntent("add two checkpoints to my eye see eff prep", ctx(m.caller));
      assert.equal(u.planMention, "my eye see eff prep");
      const t = mock(answer("add_task", 0.92, { clean_title: "Pack cleats" }));
      const v = await classifyIntent("oh and remind me I need to pack my cleats", ctx(t.caller));
      assert.equal(t.calls.length, 1);
      assert.equal(v.cleanTitle, "Pack cleats");
      assert.equal(v.route, "draft");
    });

    test("confidence under 0.6, or intent clarify, asks with the three taps", async () => {
      const low = await classifyIntent("prep stuff", ctx(mock(answer("new_plan", 0.4)).caller));
      assert.equal(low.route, "clarify");
      assert.equal(low.intent, "new_plan");
      const clar = await classifyIntent("move it", ctx(mock(answer("clarify", 0.9)).caller));
      assert.equal(clar.route, "clarify");
      assert.equal(routeFor({ intent: "add_task", confidence: MIN_CONFIDENCE }), "draft");
      assert.deepEqual([...CLARIFY_OPTIONS], ["Make a plan", "Just add one task", "Just talking"]);
    });

    test("failed call, thrown error or bad JSON: the old rule, never a crash", async () => {
      const failed = await classifyIntent("what should I do for my ICF project?", ctx(mock(null).caller));
      assert.equal(failed.via, "rules");
      assert.equal(failed.fallback, "call_failed");
      assert.equal(failed.route, "chat");
      const threw = await classifyIntent("help me plan my week", ctx(mock(() => { throw new Error("boom"); }).caller));
      assert.equal(threw.fallback, "call_failed");
      assert.equal(threw.route, "draft");
      for (const bad of [{ intent: "new_plan" }, answer("make_coffee"), answer("new_plan", 1.4), { ...answer("new_plan"), extra: 1 }, "not json"]) {
        const u = await classifyIntent("help me plan my week", ctx(mock(bad).caller));
        assert.equal(u.fallback, "bad_json", JSON.stringify(bad));
        assert.equal(u.via, "rules");
      }
    });

    test("the user message has the date and plans; the system prompt has neither", async () => {
      const m = mock(answer("question"));
      await classifyIntent("what's due?", ctx(m.caller));
      const msg = routerUserMessage("hi", TODAY, PLANS);
      assert.match(msg, /Sunday, 2026-10-11/);
      assert.match(msg, /"ICF Prep"/);
      assert.match(routerUserMessage("hi", TODAY, []), /plans and projects: none/);
      if (m.calls[0]) {
        assert.doesNotMatch(m.calls[0].system, /2026|ICF Prep/);
      }
    });

    test("schema: strict zod and the JSON schema agree on fields", () => {
      const keys = Object.keys(RouterOutputSchema.shape).sort();
      assert.deepEqual([...ROUTER_JSON_SCHEMA.required].sort(), keys);
      assert.deepEqual([...ROUTER_JSON_SCHEMA.properties.intent.enum], [...ROUTER_INTENTS]);
      assert.equal(ROUTER_JSON_SCHEMA.additionalProperties, false);
    });

    test("ChangeSet intents: project → new_plan, plan tasks → delete_task, tangent → question", () => {
      assert.equal(toChangeSetIntent("new_project"), "new_plan");
      assert.equal(toChangeSetIntent("delete_plan_tasks"), "delete_task");
      assert.equal(toChangeSetIntent("tangent"), "question");
      assert.equal(toChangeSetIntent("add_to_plan"), "add_to_plan");
      assert.equal(confidenceBucket(null), "none");
      assert.equal(confidenceBucket(0.3), "low");
      assert.equal(confidenceBucket(0.7), "mid");
      assert.equal(confidenceBucket(0.95), "high");
    });
  }
);
