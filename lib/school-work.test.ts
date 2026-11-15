// Run with `npm test`. Round 5A Phase 3: when a student gets School or Work.
import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./school-work");

void (import("./school-work.ts" as string) as Promise<Mod>).then(({ areasFor, missingAreas, mentionsJob, mentionsSchool }) => {
  test("Round 5A: nothing said, no areas (never both by default)", () => {
    assert.deepEqual(areasFor({}), []);
    assert.deepEqual(areasFor({ commitmentKinds: ["practice", "lessons", "family", "other"] }), []);
    assert.deepEqual(areasFor({ chatMentions: ["help me get better at chess", "I have practice after school"] }), []);
  });

  test("Round 5A: a school commitment or Canvas gives School only", () => {
    assert.deepEqual(areasFor({ commitmentKinds: ["school", "practice"] }), ["school"]);
    assert.deepEqual(areasFor({ canvasConnected: true }), ["school"]);
    assert.deepEqual(areasFor({ chatMentions: ["my teacher moved the test"] }), ["school"]);
  });

  test("Round 5A: a work commitment or a job in chat gives Work only", () => {
    assert.deepEqual(areasFor({ commitmentKinds: ["work"] }), ["work"]);
    assert.deepEqual(areasFor({ chatMentions: ["I work at Target on weekends"] }), ["work"]);
    assert.deepEqual(areasFor({ chatMentions: ["I have a shift tomorrow"] }), []);
    assert.deepEqual(areasFor({ chatMentions: ["picking up my shifts tomorrow"] }), ["work"]);
  });

  test("Round 5A: both only when both were mentioned", () => {
    assert.deepEqual(areasFor({ commitmentKinds: ["school", "work"] }), ["school", "work"]);
    assert.deepEqual(areasFor({ canvasConnected: true, chatMentions: ["my boss wants me Saturday"] }), ["school", "work"]);
  });

  test("Round 5A: mention detection", () => {
    assert.equal(mentionsJob("got a job at the library"), true);
    assert.equal(mentionsJob("I need to get this job done"), false);
    assert.equal(mentionsJob("homework after school"), false);
    assert.equal(mentionsSchool("after school I go to practice"), false);
    assert.equal(mentionsSchool("my classes start at 8"), true);
  });

  test("Round 5A: an area is created once", () => {
    assert.deepEqual(missingAreas(["school", "work"], [{ kind: "school" }, { kind: null }, {}]), ["work"]);
    assert.deepEqual(missingAreas(["school", "school"], []), ["school"]);
    assert.deepEqual(missingAreas(["work"], [{ kind: "work" }]), []);
  });
});
