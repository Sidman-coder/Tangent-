// Run with `npm test`. Round 5A 2.2/2.5: talk first, one router everywhere.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

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

type Case = { text: string; kind: string; schedulable?: boolean; planThis?: boolean; projectId?: string };
const fixture = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "talk-first.json"), "utf8")) as {
  projects: { id: string; title: string }[];
  cases: Case[];
};

const SCOPES = ["home", "capture", "task", "project", "rail", "palette"] as const;

void (import("./talk-route") as Promise<typeof import("./talk-route")>).then(({ routeMessage, planRequestText }) => {
  test("plan request text: bare 'plan it' plans the message before it; answers ride along", () => {
    const thread = [
      { role: "user", content: "help me get better at competitive programming" },
      { role: "assistant", content: "Here's how people usually climb USACO…" },
      { role: "user", content: "ok plan it" },
    ];
    assert.equal(planRequestText(thread), "help me get better at competitive programming");
    assert.equal(planRequestText(thread, { goal: "USACO Silver by March" }), "USACO Silver by March");
    assert.equal(
      planRequestText([{ role: "user", content: "an hour a day" }], { goal: "USACO Silver", answer: { question: "How much time a day?", answer: "an hour a day" } }),
      "USACO Silver\n\nMy answers to your questions:\n- How much time a day? an hour a day"
    );
    assert.equal(planRequestText([{ role: "user", content: "make me a schedule for my piano exam" }]), "make me a schedule for my piano exam");
  });

  // Every entry point (Home, /capture, task and project chats, ⌘K) calls this
  // one router: server-side in app/api/chat/route.ts, client-side in
  // useCapture. The router ignores scope by design, so one fixture gives one
  // route wherever it's typed. The loop pins that it stays that way.
  test("talk-first fixtures: the same route whatever the scope", () => {
    for (const c of fixture.cases) {
      for (const scope of SCOPES) {
        const r = routeMessage(c.text, { projects: fixture.projects, planThis: c.planThis, scope });
        assert.equal(r.kind, c.kind, `${scope}: "${c.text}" → ${r.kind}, expected ${c.kind}`);
        if (c.schedulable !== undefined) assert.equal(r.schedulable, c.schedulable, `${scope}: "${c.text}" schedulable`);
        if (c.projectId) assert.equal(r.projectId, c.projectId, `${scope}: "${c.text}" project`);
      }
    }
  });

  test("a goal message is talk, never a plan, until asked", () => {
    const r = routeMessage("help me get better at competitive programming");
    assert.equal(r.kind, "answer");
    assert.equal(r.schedulable, true);
  });

  test("a 'How do I prepare for…' question is answered first, with a plan offer, dates or not (C15)", () => {
    for (const t of [
      "How do I prepare for the AP Chem final on Thu Dec 17? I have debate Tuesday 3:30-5:00",
      "How do I study for my AP Chem final next week",
      "how should I get ready for my physics test on Friday",
    ]) {
      const r = routeMessage(t, { scope: "home" });
      assert.equal(r.kind, "answer", t);
      assert.equal(r.schedulable, true, `${t} offers the plan row`);
    }
  });

  test("inside a project, an explicit ask extends it and talk stays talk", () => {
    assert.equal(routeMessage("plan it", { scoped: "p-chem" }).kind, "extend");
    assert.equal(routeMessage("how am I doing?", { scoped: "p-chem" }).kind, "answer");
  });

  test("the Plan this button wins over talk, but not over a bulk command", () => {
    assert.equal(routeMessage("help me with chess", { planThis: true }).kind, "plan");
    assert.equal(routeMessage("delete all my tasks", { planThis: true }).kind, "action");
  });
});
