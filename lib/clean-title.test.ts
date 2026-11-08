// Run with `npm test`. Same resolve hook as schedule-slots.test.ts.
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

type CleanTitle = typeof import("./clean-title");
void (import("./clean-title") as Promise<CleanTitle>).then(({ cleanTaskTitle }) => {
  const t = (raw: string, opts?: Parameters<typeof cleanTaskTitle>[1]) => cleanTaskTitle(raw, opts).title;

  test("drops the bracketed course, teacher and section, and keeps a course chip", () => {
    assert.deepEqual(cleanTaskTitle("Molarity POGIL [P7-AP Chem-SMITH]"), { title: "Molarity POGIL", course: "AP Chem" });
    assert.deepEqual(cleanTaskTitle("unit 4 quiz [P7-AP Calculus BC-BARTHOLOMEW]"), { title: "Unit 4 quiz", course: "AP Calc" });
  });

  test("can drop the bracket without a chip", () => {
    assert.deepEqual(cleanTaskTitle("Lab 4 [Bio]", { course: "drop" }), { title: "Lab 4", course: null });
  });

  test("drops the project name in front", () => {
    const projectName = "Robotics";
    assert.equal(t("Robotics: Wire the arm motor", { projectName }), "Wire the arm motor");
    assert.equal(t("robotics - Wire the arm motor", { projectName }), "Wire the arm motor");
    assert.equal(t("Robotics — Test the gripper", { projectName }), "Test the gripper");
    assert.equal(t("[Robotics] Order servos", { projectName }), "Order servos");
    assert.equal(t("Order servos (Robotics)", { projectName }), "Order servos");
  });

  test("keeps a project name that is part of the sentence", () => {
    assert.equal(t("Robotics club meeting", { projectName: "Robotics" }), "Robotics club meeting");
    assert.equal(t("Email the robotics coach", { projectName: "Robotics" }), "Email the robotics coach");
  });

  test("handles project names with regex characters", () => {
    assert.equal(t("C++ (Intro): Read chapter 2", { projectName: "C++ (Intro)" }), "Read chapter 2");
  });

  test("drops a trailing period and extra whitespace", () => {
    assert.equal(t("  Read   pages 40-45.  "), "Read pages 40-45");
    assert.equal(t("Why did Rome fall?"), "Why did Rome fall?");
  });

  test("never returns an empty title", () => {
    assert.equal(t("Robotics:", { projectName: "Robotics" }), "Robotics:");
    assert.equal(t("[AP Chem]"), "[AP Chem]");
    assert.equal(t("."), ".");
    assert.equal(t(""), "");
  });

  test("keeps a bracket when asked (a student's own note, not a course)", () => {
    assert.equal(t("Read chapter 3 [optional]", { course: "keep" }), "Read chapter 3 [optional]");
  });

  test("leaves a clean title alone", () => {
    assert.deepEqual(cleanTaskTitle("Wire the arm motor", { projectName: "Robotics" }), { title: "Wire the arm motor", course: null });
  });
});
