// Run with `npm test`.
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

const IG = { id: "p-ig", title: "Instagram Growth to 10K" };
const CHEM = { id: "p-chem", title: "AP Chem Final Prep" };

void (import("./home-route") as Promise<typeof import("./home-route")>).then(({ homeRoute, projectFor }) => {
  test("a question about a project they have is answered, not grilled", () => {
    for (const s of [
      "how do I get more views on my instagram reels?",
      "what should I post next on instagram",
      "any ideas for my instagram",
      "how is my instagram project going",
      "how should I grow my instagram faster?",
    ]) {
      assert.deepEqual(homeRoute(s, [IG]), { kind: "answer", projectId: "p-ig" }, s);
    }
  });

  test("'my project' points at the only project", () => {
    assert.deepEqual(homeRoute("what's left on my project?", [IG]), { kind: "answer", projectId: "p-ig" });
    assert.equal(projectFor("what's left on my project?", [IG, CHEM]), null);
  });

  test("asking for more steps extends the project", () => {
    for (const s of ["plan the next round for instagram", "add more steps to my instagram plan", "help me grow my instagram", "break down my instagram growth into steps"]) {
      assert.deepEqual(homeRoute(s, [IG]), { kind: "extend", projectId: "p-ig" }, s);
    }
  });

  test("a task with a time joins the calendar, inside its project", () => {
    assert.deepEqual(homeRoute("film instagram reel tomorrow at 4pm", [IG]), { kind: "add", projectId: "p-ig" });
  });

  test("grill me is honored", () => {
    assert.equal(homeRoute("grill me on my chem final plan", [CHEM]).kind, "grill");
    assert.equal(homeRoute("ask me some questions so you can plan my week", []).kind, "grill");
  });

  test("a new goal is planned", () => {
    for (const s of ["help me get 10k followers on tiktok", "break down plan: learn guitar", "make me a plan for the SAT", "how do I become a better chess player"]) {
      assert.equal(homeRoute(s, [IG]).kind, "plan", s);
    }
  });

  test("plain questions and advice get an answer", () => {
    for (const s of ["how should I study for a calc test?", "explain spaced repetition", "is it worth doing debate and robotics", "any tips for staying focused"]) {
      assert.equal(homeRoute(s, [IG]).kind, "answer", s);
    }
  });

  test("tasks and calendar commands are added", () => {
    for (const s of ["read english chapter 6", "dentist tomorrow at 3pm", "move chem to friday", "what's due this week", "can you add soccer every tuesday"]) {
      assert.equal(homeRoute(s, [IG]).kind, "add", s);
    }
  });

  test("1.6 bulk commands are actions: never planned, never grilled, even with a project open", () => {
    for (const s of [
      "delete all my tasks and projects",
      "Delete all my tasks and projects",
      "delete all my chats",
      "clear my chat history",
      "move all today's tasks to tomorrow",
      "mark all done",
      "delete everything",
      "clear my schedule",
      "mark everything as done",
    ]) {
      for (const projects of [[], [IG], [IG, CHEM]]) {
        const r = homeRoute(s, projects);
        assert.equal(r.kind, "action", s);
        assert.ok(r.action, s);
      }
      assert.equal(homeRoute(s, [IG], "p-ig").kind, "action", `${s} (inside a project)`);
    }
  });

  test("1.6 a topic or a plain task is still not an action", () => {
    assert.notEqual(homeRoute("delete my SAT tasks", []).kind, "action");
    assert.notEqual(homeRoute("move chem to friday", [CHEM]).kind, "action");
    assert.equal(homeRoute("help me get 10k followers on tiktok", [IG]).kind, "plan");
  });

  test("inside a project page, everything is about that project", () => {
    assert.deepEqual(homeRoute("what should I do next?", [IG, CHEM], "p-chem"), { kind: "answer", projectId: "p-chem" });
    assert.deepEqual(homeRoute("add two practice tests", [IG, CHEM], "p-chem"), { kind: "extend", projectId: "p-chem" });
  });
});
