// Run with `npm test`. Round 6 (item 2): busy times and deadlines typed in a
// request are read in code, from the sims' exact sentences (2026-11-22).
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

const H = (h: number, m = 0) => h * 60 + m;

void (import("./plan-constraints") as Promise<typeof import("./plan-constraints")>).then(
  ({ busyWindows, deadlineFrom, planConstraints, daysOf, latestEndFrom, deadlineNote, deadlineFromNotes }) => {
    test("Priya: the bakery shifts are busy, and the essay deadline is Jan 5", () => {
      const c = planConstraints("ED II supplemental essay #1 draft, need it ready before Jan 5. I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm", "2026-11-23");
      assert.deepEqual(c.busy, [
        { weekday: 3, start: H(16), end: H(21), label: "bakery shifts" },
        { weekday: 6, start: H(8), end: H(14), label: "bakery shifts" },
        { weekday: 0, start: H(8), end: H(14), label: "bakery shifts" },
      ]);
      assert.deepEqual(c.deadline, { date: "2027-01-05", label: "the deadline" });
      const e2n = planConstraints(
        "ED II application due Jan 5: Common App essay (650 words), 2 supplementals, teacher rec still pending. I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm",
        "2026-11-23"
      );
      assert.equal(e2n.busy.length, 3);
      assert.equal(e2n.deadline?.date, "2027-01-05");
    });

    test("Leo: 'test Friday' is the deadline, said on a Monday", () => {
      assert.deepEqual(deadlineFrom("Algebra 2 test Friday on exponentials and logs, need to study but I'm also editing Sunday's video", "2026-11-23"), {
        date: "2026-11-27",
        label: "your test",
      });
      assert.equal(deadlineFrom("Algebra test Friday, need to get ready, and I still have to film and edit Sunday's video", "2026-11-23")?.date, "2026-11-27");
      assert.equal(busyWindows("Algebra 2 test Friday on exponentials and logs").length, 0);
    });

    test("Maya: debate Tue 3:30-5, nothing after 11pm, final Thu Dec 17", () => {
      const c = planConstraints(
        "the final is Thu Dec 17 not tomorrow. spread study sessions over the weeks before it, not tue 3:30-5 (debate) and nothing after 11pm",
        "2026-11-22"
      );
      assert.deepEqual(c.busy, [{ weekday: 2, start: H(15, 30), end: H(17), label: "debate" }]);
      assert.equal(c.latestEnd, H(23));
      assert.deepEqual(c.deadline, { date: "2026-12-17", label: "your final" });
      assert.ok(c.avoid.some((w) => w.weekday === 2 && w.start === H(15, 30) && w.end === H(17)));
      assert.equal(c.avoid.filter((w) => w.start === H(23)).length, 7);
      assert.equal(deadlineFrom("AP Chem final is Thu Dec 17. make me a study plan before it", "2026-11-22")?.date, "2026-12-17");
    });

    test("other wordings: soccer Mon–Fri, Tue and Thu, weekends; a time to use is not busy", () => {
      assert.equal(busyWindows("soccer Mon–Fri 3:30–5:30, help me plan my robotics build").length, 5);
      assert.deepEqual(
        busyWindows("I have chess club Tue and Thu 4-5:30pm").map((w) => [w.weekday, w.label]),
        [
          [2, "chess club"],
          [4, "chess club"],
        ]
      );
      assert.deepEqual(daysOf("weekends"), [6, 0]);
      assert.deepEqual(daysOf("Sat-Sun"), [6, 0]);
      assert.deepEqual(daysOf("mon to wed"), [1, 2, 3]);
      assert.deepEqual(busyWindows("study tue 3:30-5 and work on essay wed 4-5"), []);
      assert.deepEqual(busyWindows("I'm free sat 10-12"), []);
      assert.equal(latestEndFrom("no sessions past 9:30"), H(21, 30));
    });

    test("deadlines: none in the past, none without an exam or due word; notes round-trip", () => {
      assert.equal(deadlineFrom("plan my week", "2026-11-23"), null);
      assert.equal(deadlineFrom("from Dec 28 to Jan 4 I want to learn chess", "2026-11-23"), null);
      assert.equal(deadlineFrom("my essay is due Mon", "2026-11-23")?.date, "2026-11-30");
      assert.equal(deadlineFrom("bio quiz tomorrow", "2026-11-23")?.date, "2026-11-24");
      const d = { date: "2026-12-17", label: "your final" };
      assert.deepEqual(deadlineFromNotes(`Goal: ace it\n${deadlineNote(d)}`), d);
    });
  }
);
