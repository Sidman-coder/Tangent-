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

  test("trailing filler and when-words the date and time hold are stripped", () => {
    const cases: [string, string][] = [
      ["I have a soccer coaching appointment coming up tomorrow 10pm", "Soccer coaching appointment"],
      ["I have a soccer coaching appointment coming up", "Soccer coaching appointment"],
      ["I have a test next week", "Test"],
      ["dentist tomorrow at 3pm", "Dentist"],
      ["call grandma tonight", "Call grandma"],
      ["bio quiz on friday", "Bio quiz"],
      ["essay draft by thursday", "Essay draft"],
      ["piano practice weekdays", "Piano practice"],
      ["study for chem later", "Study for chem"],
      ["return library books soon", "Return library books"],
      ["schedule a meeting with Ms. Lee at 3", "Meeting with Ms. Lee"],
      ["put SAT practice on my calendar", "SAT practice"],
      ["add SAT practice tomorrow", "SAT practice"],
      ["I need to finish the lab report at 10:30", "Finish the lab report"],
      ["I've got a chem quiz thursday at 3", "Chem quiz"],
      ["pizza night friday", "Pizza night"],
    ];
    for (const [raw, want] of cases) assert.equal(cleanTitle(raw), want, raw);
  });

  test("titles that are the task itself stay unchanged", () => {
    for (const title of [
      "Add math notes to binder",
      "Put laundry away",
      "Study for the SAT",
      "Read chapter 10",
      "Soccer coaching appointment",
      "Plan the week",
      "Today show recap",
      "Study for monday",
      "Plans after friday",
    ]) {
      assert.equal(cleanTitle(title), title, title);
    }
  });

  test("never leaves fewer than 2 characters", () => {
    assert.equal(cleanTitle("tomorrow"), "Tomorrow");
    assert.equal(cleanTitle("a tonight"), "A tonight");
    assert.equal(cleanTitle("I have a"), "I have a");
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
