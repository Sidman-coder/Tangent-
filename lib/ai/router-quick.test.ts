// Run with `npm test`. Same resolve hook as schedule-slots.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith("@/")) specifier = new URL(`../../${specifier.slice(2)}`, import.meta.url).href;
    if ((specifier.startsWith(".") || specifier.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(specifier)) {
      try {
        return next(`${specifier}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(specifier, context);
  },
});

type Router = typeof import("./router");
void (import("./router") as Promise<Router>).then(({ quickCapture, splitCaptureItems, isDatedExam, routeCommand }) => {
  test("'what's due this week' on a weekend means the week ahead (overnight 2)", () => {
    const sun = routeCommand("what's due this week?", "America/New_York", new Date("2026-11-22T12:00:00-05:00"));
    assert.deepEqual(sun, { op: "due", range: "week", start: "2026-11-22", end: "2026-11-28" });
    const wed = routeCommand("what's due this week", "America/New_York", new Date("2026-11-18T12:00:00-05:00"));
    assert.deepEqual(wed, { op: "due", range: "week", start: "2026-11-18", end: "2026-11-22" });
  });

  test("an exam is told apart from work for it (overnight 2, Maya sim)", () => {
    for (const t of ["AP Chem final", "bio quiz", "SAT", "Calc midterm", "chem test"]) assert.equal(isDatedExam(t), true, t);
    for (const t of ["SAT practice test", "study for chem test", "review for bio quiz", "Read english chapter 6", "Dentist"]) assert.equal(isDatedExam(t), false, t);
  });

  const tz = "America/New_York";
  const at = new Date("2026-10-10T16:00:00-04:00"); // Saturday afternoon

  test("plain to-dos are captured without the model", () => {
    assert.deepEqual(quickCapture("read english chapter 6", tz, at), { title: "Read english chapter 6", date: undefined, time: undefined, deadline: undefined });
    assert.equal(quickCapture("remind me to email ms. lee", tz, at)?.title, "Email ms. lee");
    assert.deepEqual(quickCapture("dentist tomorrow at 3pm", tz, at), { title: "Dentist", date: "2026-10-11", time: "15:00", deadline: undefined });
  });

  test("two dated things in one line become two items with their typed days (C09)", () => {
    const items = splitCaptureItems("AP Chem unit exam Friday, Precalc quiz Tuesday", tz, at);
    assert.equal(items?.length, 2);
    assert.deepEqual(items?.map((i) => [i.title, i.date]), [["AP Chem unit exam", "2026-10-16"], ["Precalc quiz", "2026-10-13"]]);
  });

  test("a list is not split when any piece has no day, or when it is a plan or question (C09)", () => {
    assert.equal(splitCaptureItems("AP Chem unit exam Friday, Precalc quiz", tz, at), null);
    assert.equal(splitCaptureItems("help me study for chem, and bio", tz, at), null);
    assert.equal(splitCaptureItems("what is due Friday, and Tuesday?", tz, at), null);
    assert.equal(splitCaptureItems("dentist tomorrow", tz, at), null);
  });

  test("a due day counts, and one undated to-do rides along when most have days (overnight 2 L4, calc-and-essay)", () => {
    const two = splitCaptureItems("calc test friday and english essay due monday", tz, at);
    assert.deepEqual(two?.map((i) => [i.title, i.date, i.deadline]), [["Calc test", "2026-10-16", undefined], ["English essay", undefined, "2026-10-12"]]);
    const three = splitCaptureItems("math hw due Thu, dentist Fri 3pm, start reading Gatsby", tz, at);
    assert.deepEqual(three?.map((i) => i.title), ["Math hw", "Dentist", "Start reading Gatsby"]);
    assert.equal(three?.[1].time, "15:00");
    assert.equal(splitCaptureItems("study chem and bio friday", tz, at), null);
    assert.deepEqual(quickCapture("chem test Thu Dec 17", tz, at)?.title, "Chem test");
    assert.equal(quickCapture("SAT practice test", tz, at)?.title, "SAT practice test");
  });

  test("Sat and Sun are days next to a time or after due/on; SAT stays the exam (overnight 2 L4c)", () => {
    // Same as spelling the day out.
    assert.deepEqual(quickCapture("guitar Sat 10am", tz, at), quickCapture("guitar saturday 10am", tz, at));
    assert.equal(quickCapture("guitar Sat 10am", tz, at)?.title, "Guitar");
    assert.equal(quickCapture("essay due sun", tz, at)?.deadline, "2026-10-11");
    assert.equal(quickCapture("SAT 8am", tz, at)?.title?.startsWith("SAT"), true);
    assert.equal(quickCapture("SAT practice test", tz, at)?.title, "SAT practice test");
    const three = splitCaptureItems("physics lab due Wed, guitar Sat 10am, start reading Macbeth", tz, at);
    assert.deepEqual(three?.map((i) => i.title), ["Physics lab", "Guitar", "Start reading Macbeth"]);
  });

  test("a due clause becomes a deadline, not the day it happens", () => {
    const c = quickCapture("chem lab report due friday", tz, at);
    assert.equal(c?.title, "Chem lab report");
    assert.equal(c?.deadline, "2026-10-16");
    assert.equal(c?.date, undefined);
  });

  test("commands, questions, plans and lists go to the model", () => {
    for (const s of [
      "what's due this week",
      "move chem to friday at 4pm",
      "mark essay done",
      "make me a plan for finals",
      "soccer every tuesday",
      "buy milk, eggs, bread",
      "is my essay due friday?",
      "help me get better at chess",
      "clear my schedule",
    ]) {
      assert.equal(quickCapture(s, tz, at), null, s);
    }
  });
});
