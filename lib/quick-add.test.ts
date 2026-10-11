// Run with `npm test`. Quick-add title cleanup and the untimed default (lib/quick-add.ts).
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

type Mod = typeof import("./quick-add");

void (import("./quick-add") as Promise<Mod>).then(({ cleanTitle, hasTimeWords }) => {
  test("lead-ins are stripped and the first letter capitalized", () => {
    const cases: [string, string][] = [
      ["I have a dentists appointment", "Dentists appointment"],
      ["I've got an orthodontist visit", "Orthodontist visit"],
      ["I need to finish the chem lab.", "Finish the chem lab"],
      ["remind me to call grandma", "Call grandma"],
      ["there's a bio quiz", "Bio quiz"],
      ["don't forget to return library books", "Return library books"],
      ["add SAT practice", "SAT practice"],
      ["add a soccer game", "Soccer game"],
      ["please remind me to email Ms. Lee", "Email Ms. Lee"],
      ["Dentist", "Dentist"],
      ["I've got appointment", "Appointment"],
    ];
    for (const [raw, want] of cases) assert.equal(cleanTitle(raw), want, raw);
  });

  test("a title that is only a lead-in is kept as typed", () => {
    assert.equal(cleanTitle("add"), "Add");
    assert.equal(cleanTitle("  "), "");
  });

  test("requests with no time are untimed", () => {
    for (const text of ["I have a dentists appointment", "add SAT practice tomorrow", "bio quiz on friday", "remind me to call grandma"]) {
      assert.equal(hasTimeWords(text), false, text);
    }
  });

  test("requests that say when keep their time", () => {
    for (const text of ["dentist at 4", "dentist at 4pm", "dentist 3:30", "practice tomorrow morning", "call grandma tonight", "study after school", "meet at 10 a.m.", "5 o'clock run"]) {
      assert.equal(hasTimeWords(text), true, text);
    }
  });
});
