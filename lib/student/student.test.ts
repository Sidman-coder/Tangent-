// Run with `npm test`. Same resolve hook as lib/context/context.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";

type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      try { return next(`${specifier}.ts`, context); } catch { /* fall through */ }
    }
    return next(specifier, context);
  },
});

type Facts = typeof import("./facts");
type Sensitive = typeof import("./sensitive");
type Obs = typeof import("./observations");

void Promise.all([import("./facts") as Promise<Facts>, import("./sensitive") as Promise<Sensitive>, import("./observations") as Promise<Obs>]).then(
  ([facts, sensitive, obs]) => {
    const { formatFact, slotFactText, isVagueValue, factCategoryFor, legacyCategoryOf, FACT_CATEGORIES, prepareFact, factView } = facts;
    const { sensitiveKind, isSensitive, looksDistressed, DISTRESS_REPLY } = sensitive;
    const { timeMultiplier, completionByHour, preferredStepSize, calibrationLines, hourLabel } = obs;

    // ─── formatFact ─────────────────────────────────────────────────────────

    test("formatFact: GetToKnowYou labels become second person", () => {
      assert.equal(formatFact("Does their best work: Late at night").text, "You do your best work late at night");
      assert.equal(formatFact("Does their best work: Mornings, Evenings").text, "You do your best work in the morning and in the evening");
      assert.equal(formatFact("Working toward: Varsity soccer").text, "You're working toward varsity soccer");
      assert.equal(formatFact("Can handle about 2 hours of work on a school night").text, "You can handle about 2 hours of work on a school night");
      assert.equal(formatFact("Tends to let slip: Reading").text, "You tend to let reading slip");
    });

    test("formatFact: vague facts are hidden and become a follow-up", () => {
      const big = formatFact("Coming up that matters: A big test");
      assert.equal(big.vague, true);
      assert.equal(big.text, "");
      assert.equal(big.followUp, "What's the big test that's coming up, and when is it?");
      assert.equal(formatFact("Deadline: No real deadline").vague, true);
      assert.equal(formatFact("Working toward: stuff").vague, true);
    });

    test("formatFact: 'nothing fixed' is dropped, not asked again", () => {
      const r = formatFact("Plan around: Nothing fixed");
      assert.deepEqual(r, { text: "", vague: false, followUp: null });
    });

    test("formatFact: grill answers and slot labels", () => {
      assert.equal(formatFact("SAT prep, hours a week: 3–5 hrs").text, "You can give 3–5 hrs a week to SAT prep");
      assert.equal(formatFact("[preference] Likes to work: Evenings").text, "You like to work in the evening");
      assert.equal(slotFactText("Hours a week", "4", "SAT prep").text, "You can give 4 hrs a week to SAT prep");
      assert.equal(slotFactText("Followers", "100–1k").text, "You have about 100–1k followers");
      assert.equal(slotFactText("Platform", "Instagram").text, "You post on Instagram");
      assert.equal(slotFactText("Weakest parts", "Not sure yet", "SAT").vague, true);
      assert.equal(slotFactText("Members so far", "Just me", "Robotics club").text, "Robotics club is just you so far");
    });

    test("formatFact: third person to second person", () => {
      assert.equal(formatFact("Prefers to study in the morning").text, "You prefer to study in the morning");
      assert.equal(formatFact("The user has soccer on Tuesdays").text, "You have soccer on Tuesdays");
      assert.equal(formatFact("Watches their little brother after school").text, "You watch your little brother after school");
      assert.equal(formatFact("Is on the debate team").text, "You are on the debate team");
    });

    test("formatFact: the student's own words stay as typed", () => {
      assert.equal(formatFact("I have practice Mon/Wed until 6").text, "I have practice Mon/Wed until 6");
      assert.equal(formatFact("Math is hardest").text, "Math is hardest");
      assert.equal(formatFact("   ").text, "");
    });

    test("formatFact: question-and-answer lines", () => {
      assert.equal(formatFact("What subject is hardest: Math").text, "What subject is hardest? Math");
      assert.equal(formatFact("What subject is hardest: idk").vague, true);
    });

    test("isVagueValue", () => {
      for (const v of ["a big test", "Something", "not sure", "idk", "the project", "nothing."]) assert.equal(isVagueValue(v), true, v);
      for (const v of ["AP Bio exam on May 12", "3 hrs", "Instagram"]) assert.equal(isVagueValue(v), false, v);
    });

    test("categories round-trip to the legacy check", () => {
      for (const c of FACT_CATEGORIES) assert.ok(["preference", "habit", "commitment", "goal", "person", "work", "general"].includes(legacyCategoryOf(c)));
      assert.equal(factCategoryFor("goal", "Get a 1450 on the SAT"), "goals");
      assert.ok(FACT_CATEGORIES.includes(factCategoryFor("general", "anything")));
    });

    // ─── Sensitive ──────────────────────────────────────────────────────────

    test("sensitive details are never kept", () => {
      const cases: [string, string][] = [
        ["I have anxiety before tests", "mental_health"],
        ["Seeing my therapist on Thursdays", "mental_health"],
        ["I have asthma so no running", "health"],
        ["Recovering from a concussion", "health"],
        ["My parents are getting divorced", "family_conflict"],
        ["My dad yells at me when I'm late", "family_conflict"],
        ["My password is hunter2", "other"],
      ];
      for (const [text, kind] of cases) assert.equal(sensitiveKind(text), kind, text);
    });

    test("ordinary facts are kept", () => {
      for (const text of [
        "You do your best work late at night",
        "Soccer practice Mon/Wed until 6",
        "Wants a 1450 on the SAT",
        "Has to babysit on Fridays",
        "Address the essay prompt first",
        "Trans-Atlantic history unit is hardest",
        "This test is killing me",
      ]) assert.equal(isSensitive(text), false, text);
    });

    test("distress check catches real distress, not figures of speech", () => {
      assert.equal(looksDistressed("honestly i want to die"), true);
      assert.equal(looksDistressed("I've been thinking about killing myself"), true);
      assert.equal(looksDistressed("I don't want to be alive anymore"), true);
      assert.equal(looksDistressed("this calc homework is killing me lol"), false);
      assert.equal(looksDistressed("I'm dying to finish this"), false);
      assert.match(DISTRESS_REPLY, /988/);
      assert.match(DISTRESS_REPLY, /trusted adult/);
    });

    // ─── Observations ───────────────────────────────────────────────────────

    const done = (minutes: number, actual: number | null, hour = 20) =>
      ({ kind: "done" as const, hour, weekday: 2, minutes, actualMinutes: actual, code: null });
    const ev = (kind: "too_big" | "not_today" | "check_in" | "skipped", code: string | null = null) =>
      ({ kind, hour: 18, weekday: 2, minutes: 30, actualMinutes: null, code });

    test("timeMultiplier: 1 until there are enough samples", () => {
      assert.deepEqual(timeMultiplier([]), { value: 1, samples: 0 });
      assert.deepEqual(timeMultiplier([done(30, 60), done(30, 60)]), { value: 1, samples: 2 });
    });

    test("timeMultiplier: median of actual ÷ estimate and check-ins", () => {
      assert.equal(timeMultiplier([done(30, 45), done(20, 30), done(60, 90)]).value, 1.5);
      assert.equal(timeMultiplier([ev("check_in", "longer"), ev("check_in", "much_longer"), done(30, 60)]).value, 2);
      // Clamped so one disaster can't wreck every plan.
      assert.equal(timeMultiplier([done(10, 100), done(10, 100), done(10, 100)]).value, 2.5);
      assert.equal(timeMultiplier([done(60, 10), done(60, 10), done(60, 10)]).value, 0.5);
    });

    test("completionByHour: best hours once there are enough done steps", () => {
      const few = completionByHour([done(30, null, 21), done(30, null, 21)]);
      assert.deepEqual(few.value.best, []);
      const many = completionByHour([21, 21, 21, 22, 16, 21, 9].map((h) => done(30, null, h)));
      assert.equal(many.samples, 7);
      assert.equal(many.value.best[0], 21);
      assert.equal(many.value.done[21], 4);
      assert.ok(!many.value.best.includes(9));
    });

    test("preferredStepSize: median of finished steps, smaller when pushed back", () => {
      assert.equal(preferredStepSize([done(30, null), done(30, null)]).value, null);
      const five = [30, 30, 30, 45, 20].map((m) => done(m, null));
      assert.equal(preferredStepSize(five).value, 30);
      assert.equal(preferredStepSize([...five, ev("too_big"), ev("too_big")]).value, 25); // 2/7 ≈ 0.29 → ×0.75 = 22.5 → 25
      assert.equal(preferredStepSize([...five, ev("too_big"), ev("too_big"), ev("too_big"), ev("too_big")]).value, 20); // 4/9 → ×0.6 = 18 → 20
      assert.equal(preferredStepSize([...five, ev("not_today", "forgot"), ev("not_today", "forgot")]).value, 30);
      assert.equal(preferredStepSize([5, 5, 5, 5, 5].map((m) => done(m, null))).value, 10);
    });

    test("calibrationLines: silent until sure", () => {
      assert.deepEqual(calibrationLines([done(30, 30)]), []);
      const lines = calibrationLines([done(30, 60, 21), done(30, 60, 21), done(30, 60, 21), done(30, 60, 21), done(30, 60, 22)]);
      assert.ok(lines.some((l) => l.includes("2×")));
      assert.ok(lines.some((l) => l.includes("9pm")));
      assert.ok(lines.some((l) => l.includes("30 minutes")));
      assert.equal(hourLabel(0), "12am");
      assert.equal(hourLabel(12), "12pm");
    });

    // ─── Writing and showing facts ──────────────────────────────────────────

    test("prepareFact: sensitive and vague facts are never saved", () => {
      assert.deepEqual(prepareFact({ category: "general", fact: "I have anxiety before tests", source: "chat" }), { ok: false, reason: "sensitive" });
      assert.deepEqual(prepareFact({ category: "goal", fact: "Working toward: stuff", source: "manual" }), { ok: false, reason: "vague" });
      assert.deepEqual(prepareFact({ category: "general", fact: "   ", source: "chat" }), { ok: false, reason: "empty" });
    });

    test("prepareFact: keeps the words, shows second person, sets source and confidence", () => {
      const r = prepareFact({ category: "habit", fact: "Does their best work: Late at night", source: "manual" });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.equal(r.fact, "Does their best work: Late at night");
      assert.equal(r.display, "You do your best work late at night");
      assert.equal(r.factSource, "said");
      assert.equal(r.confidence, 1);
      const guess = prepareFact({ category: "habit", fact: "Works best after dinner", source: "chat", factSource: "guessed" });
      assert.equal(guess.ok && guess.factSource, "guessed");
      assert.equal(guess.ok && guess.confidence, 0.4);
    });

    test("factView: guesses are flagged, sensitive rows hidden, saved wording wins", () => {
      assert.equal(factView({ fact: "Likes mornings", displayText: null, factSource: "guessed" }).unconfirmed, true);
      assert.equal(factView({ fact: "My parents are getting divorced", displayText: "x", factSource: "said" }).hidden, true);
      const saved = factView({ fact: "Does their best work: Late at night", displayText: "You work best late", factSource: "said" });
      assert.equal(saved.display, "You work best late");
      assert.equal(saved.needsCleanup, false);
      const fresh = factView({ fact: "Does their best work: Late at night", displayText: null, factSource: null });
      assert.equal(fresh.needsCleanup, true);
      const vague = factView({ fact: "Coming up that matters: A big test", displayText: null, factSource: "said" });
      assert.equal(vague.hidden, true);
      assert.ok(vague.followUp);
    });
  },
);
