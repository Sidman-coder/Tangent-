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

type Course = typeof import("./course");
void (import("./course") as Promise<Course>).then(({ cleanCourse, courseChip, splitCourse }) => {

const canvas = (title: string) => ({ title, source: "canvas" as const });

test("splits the course off a Canvas title", () => {
  assert.deepEqual(splitCourse(canvas("Molarity POGIL [Super Chem 2026]")), { title: "Molarity POGIL", course: "Chem" });
  assert.deepEqual(splitCourse(canvas("unit 4 quiz [P7-AP Calculus BC-BARTHOLOMEW]")), { title: "unit 4 quiz", course: "AP Calc" });
  assert.deepEqual(splitCourse(canvas("Strings Practice 2 [P1 - Advanced Orchestra]")), { title: "Strings Practice 2", course: "Music" });
});

test("strips period codes, surnames and years", () => {
  assert.equal(cleanCourse("P7-AP Calculus BC-BARTHOLOMEW"), "AP Calculus BC");
  assert.equal(cleanCourse("Super Chem 2026"), "Super Chem");
  assert.equal(courseChip("AP World History"), "AP World");
  assert.equal(courseChip(cleanCourse("P1 - APCSP - Mecha")), "AP CS");
  assert.equal(courseChip("Robotics - Mecha"), "Robotics Mecha");
});

test("leaves non-Canvas titles alone", () => {
  assert.deepEqual(splitCourse({ title: "Buy milk [later]", source: undefined }), { title: "Buy milk [later]", course: null });
});
});
