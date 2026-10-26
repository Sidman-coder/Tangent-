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

type V = typeof import("./voice-intent");
void (import("./voice-intent") as Promise<V>).then(({ heardSomethingToAdd, soundsLikeATask }) => {

test("a stray word or filler is not a task", () => {
  for (const t of ["wow", "Wow.", "um", "okay okay", "uh hi", "Thank you.", "testing", "Hmm, wow!"]) {
    assert.equal(heardSomethingToAdd(t), false, t);
  }
});

test("real asks go straight through", () => {
  for (const t of ["buy poster board tomorrow", "chem homework", "Email Ms. Lee about the field trip", "um study for the SAT"]) {
    assert.equal(heardSomethingToAdd(t), true, t);
  }
});

test("talk aimed at the app is not a task", () => {
  for (const t of ["listen to me", "Listen to me!", "can you hear me", "are you there", "is this working", "hey tangent", "never mind", "wait wait stop", "I don't know", "what can you do", "you're not listening", "say something"]) {
    assert.equal(soundsLikeATask(t), false, t);
  }
});

test("real tasks still sound like tasks, including ones that use the same verbs", () => {
  for (const t of ["buy poster board tomorrow", "chem homework", "listen to the APUSH podcast", "call mom", "help me with calc homework", "tell Sid about the demo", "study for the SAT", "work on the robotics CAD", "go to sleep by 11"]) {
    assert.equal(soundsLikeATask(t), true, t);
  }
});

});
