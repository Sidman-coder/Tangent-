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

type Mod = typeof import("./task-kind");
void (import("./task-kind") as Promise<Mod>).then(
  ({ classifyTaskKind, classifyWithAsk, commitmentOf, commitmentLabel, createClassifyCache, isCalendarImport, CLASSIFY_CONFIDENCE_FLOOR }) => {
    type Source = "capture" | "calendar" | "canvas" | "plan" | "manual";
    const cases: [string, boolean, Source, string | null, string][] = [
      ["Dentist appointment Thursday 3pm", false, "capture", null, "fixed"],
      ["chess class 5pm", false, "capture", null, "fixed"],
      ["call grandma", false, "capture", null, "reminder"],
      ["turn in permission slip", false, "capture", null, "reminder"],
      ["practice piano 20 min", false, "capture", null, "flexible"],
      ["read APUSH chapter 12", false, "capture", "project-1", "flexible"],
      ["SAT practice test Saturday 8am", false, "capture", null, "fixed"],
      ["soccer practice 5pm", false, "capture", null, "fixed"],
      ["practice at 6", false, "capture", null, "fixed"],
      ["practice test Saturday 8am", false, "capture", null, "fixed"],
      ["doctor", true, "manual", null, "fixed"],
      ["math exam 9am", false, "capture", null, "fixed"],
      ["call dentist at 3pm", false, "capture", null, "reminder"],
      ["email Ms. Lee about the extension", false, "capture", null, "reminder"],
      ["pay phone bill", false, "capture", null, "reminder"],
      ["bring cleats to practice", false, "capture", null, "reminder"],
      ["remind me to bring my lab notebook to class tomorrow", false, "capture", null, "reminder"],
      ["sign up for the SAT", false, "capture", null, "reminder"],
      ["permission form turn in", false, "capture", null, "reminder"],
      ["study for chem test", false, "capture", null, "flexible"],
      ["write college essay draft", false, "capture", null, "flexible"],
      ["finish problem set 4", false, "manual", null, "flexible"],
      ["AP Lit: 30 min annotation", false, "capture", null, "flexible"],
      ["Quiz 4 [AP Chem]", false, "canvas", null, "fixed"],
      ["Team sync", true, "calendar", null, "fixed"],
      ["Robotics CAD: intake arm", true, "plan", "project-2", "flexible"],
    ];
    for (const [title, hasFixedTime, source, projectId, want] of cases) {
      test(`"${title}" is ${want}`, () => {
        assert.equal(classifyTaskKind({ title, hasFixedTime, source, projectId }).kind, want);
      });
    }

    test("the rules' strong answers don't need Haiku", () => {
      for (const title of ["Dentist appointment Thursday 3pm", "call grandma", "practice piano 20 min"]) {
        const { confidence } = classifyTaskKind({ title, hasFixedTime: false, source: "capture" });
        assert.ok(confidence >= CLASSIFY_CONFIDENCE_FLOOR, title);
      }
    });

    test("the rules' weak answers do", () => {
      for (const title of ["piano lesson", "laundry", "email my counselor about the summer program deadline"]) {
        const { confidence } = classifyTaskKind({ title, hasFixedTime: false, source: "capture" });
        assert.ok(confidence < CLASSIFY_CONFIDENCE_FLOOR, title);
      }
    });

    const task = (extra: Record<string, unknown>) => ({
      id: "t",
      title: "Walk the dog",
      date: "2026-11-04",
      time: "",
      completed: false,
      ...extra,
    });

    test("commitmentOf trusts what was stored", () => {
      assert.equal(commitmentOf(task({ commitment: "reminder", title: "Dentist appointment 3pm" })), "reminder");
    });

    test("commitmentOf falls back to the rules before the migration", () => {
      assert.equal(commitmentOf(task({ title: "Dentist appointment", time: "15:30" })), "fixed");
      assert.equal(commitmentOf(task({ title: "call grandma" })), "reminder");
      assert.equal(commitmentOf(task({ source: "canvas", title: "Lab 4" })), "fixed");
      assert.equal(commitmentOf(task({ kind: "commitment", title: "Robotics" })), "fixed");
      assert.equal(commitmentOf(task({ planId: "p", title: "Dentist appointment", time: "15:30" })), "flexible");
    });

    test("commitmentOf reads a weak guess as flexible, like the backfill", () => {
      assert.equal(commitmentOf(task({ title: "Walk the dog", time: "17:00" })), "flexible");
      assert.equal(commitmentOf(task({ title: "piano lesson" })), "flexible");
    });

    test("a calendar import is known by its note", () => {
      assert.equal(isCalendarImport({ notes: "From school.ics" }), true);
      assert.equal(isCalendarImport({ notes: "All day · At Gym · From your calendar" }), true);
      assert.equal(isCalendarImport({ notes: "Ask Dad where this came from" }), false);
      assert.equal(isCalendarImport({}), false);
      assert.equal(commitmentOf(task({ notes: "From school.ics", title: "Pep rally" })), "fixed");
    });

    test("preview labels", () => {
      assert.equal(commitmentLabel("fixed"), "Appointment");
      assert.equal(commitmentLabel("reminder"), "Reminder");
      assert.equal(commitmentLabel("flexible"), "Goal step");
    });

    const weak = { title: "piano lesson", hasFixedTime: false, source: "capture" as const };

    test("a sure rule never asks", async () => {
      let asked = 0;
      const out = await classifyWithAsk(
        { title: "call grandma", hasFixedTime: false, source: "capture" },
        async () => {
          asked += 1;
          return "fixed";
        },
        createClassifyCache(5)
      );
      assert.equal(asked, 0);
      assert.equal(out.kind, "reminder");
    });

    test("an unsure rule asks once per title", async () => {
      let asked = 0;
      const ask = async () => {
        asked += 1;
        return "fixed" as const;
      };
      const cache = createClassifyCache(5);
      assert.equal((await classifyWithAsk(weak, ask, cache)).kind, "fixed");
      const again = await classifyWithAsk({ ...weak, title: "  Piano   LESSON " }, ask, cache);
      assert.equal(again.kind, "fixed");
      assert.equal(again.confidence, CLASSIFY_CONFIDENCE_FLOOR);
      assert.equal(asked, 1);
    });

    test("a failed ask reads as flexible and is asked again next time", async () => {
      const cache = createClassifyCache(5);
      assert.equal((await classifyWithAsk(weak, async () => null, cache)).kind, "flexible");
      const thrown = await classifyWithAsk(weak, () => Promise.reject(new Error("down")), cache);
      assert.equal(thrown.kind, "flexible");
      assert.equal((await classifyWithAsk(weak, async () => "reminder", cache)).kind, "reminder");
    });

    test("the cache forgets its oldest answer when full", () => {
      const cache = createClassifyCache(2);
      cache.set("a", "fixed");
      cache.set("b", "reminder");
      cache.set("c", "flexible");
      assert.equal(cache.get("a"), undefined);
      assert.equal(cache.get("b"), "reminder");
      assert.equal(cache.get("c"), "flexible");
    });
  }
);
