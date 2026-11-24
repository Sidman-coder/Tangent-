// Run with `npm test`. Round 6 (item 5): stated busy time → one offer → a
// commitment (cmt_ series) → a later capture is placed outside it.
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

const PRIYA = "Help me write my ED II supplemental essay, it needs to be ready before Jan 5. I work at the bakery Wed 4-9pm and Sat-Sun 8am-2pm";
const WED = "2026-11-25";

void Promise.all([
  import("./busy-offer") as Promise<typeof import("./busy-offer")>,
  import("./commitments") as Promise<typeof import("./commitments")>,
  import("./load") as Promise<typeof import("./load")>,
]).then(([{ busyOffer, busyOfferQuestion }, { commitmentTasks, commitmentsFromTasks, parseCommitment, commitmentProblem }, { placeTask, DEFAULT_CAPACITY }]) => {
  test("Priya's bakery shifts give one offer, as a weekly work commitment", () => {
    const o = busyOffer(PRIYA);
    assert.ok(o);
    assert.equal(busyOfferQuestion(o), "Add bakery shifts as busy time?");
    assert.deepEqual(o.commitment, {
      kind: "work",
      name: "Bakery shifts",
      repeat: { kind: "weekly" },
      blocks: [
        { days: [3], start: "16:00", end: "21:00" },
        { days: [0, 6], start: "08:00", end: "14:00" },
      ],
    });
    // It's a commitment the existing path accepts as it is.
    assert.deepEqual(parseCommitment(o.commitment), o.commitment);
    assert.equal(commitmentProblem(o.commitment), null);
  });

  test("other sports and lessons; no offer for a time to use, an unnamed block or one already saved", () => {
    assert.equal(busyOffer("soccer Mon-Fri 3:30-5:30, help me study for bio")?.commitment.kind, "practice");
    assert.deepEqual(busyOffer("soccer Mon-Fri 3:30-5:30")?.commitment.blocks, [{ days: [1, 2, 3, 4, 5], start: "15:30", end: "17:30" }]);
    assert.equal(busyOffer("I have piano lessons Thu 5-6pm")?.commitment.kind, "lessons");
    assert.equal(busyOffer("study tue 3:30-5 for the chem test"), null);
    assert.equal(busyOffer("work on my essay tue 4-5"), null);
    assert.equal(busyOffer("plan my chem final, not tue 3:30-5"), null);
    assert.equal(busyOffer("help me get a 1400 on the SAT"), null);
    const saved = busyOffer(PRIYA)!.commitment;
    assert.equal(busyOffer(PRIYA, [{ ...saved, id: "cmt_x" }]), null);
  });

  test("Yes → cmt_ busy tasks → Settings reads it back → a later capture lands outside the shift", () => {
    const o = busyOffer(PRIYA)!;
    const tasks = commitmentTasks([o.commitment], "2026-11-23", "t1").map((t, i) => ({ ...t, id: `c${i}` }));
    assert.ok(tasks.length > 0 && tasks.every((t) => t.recurring?.parentId?.startsWith("cmt_")));
    // Settings → Schedule lists it (it reads commitments back from the calendar).
    const back = commitmentsFromTasks(tasks);
    assert.equal(back.length, 1);
    assert.equal(back[0].name, "Bakery shifts");
    assert.deepEqual(back[0].blocks, o.commitment.blocks);
    // A single untimed capture on Wednesday morning, an hour long. Before: Wed 3:30 PM, into the shift.
    const now = { date: WED, minutes: 9 * 60 };
    const before = placeTask([], { now, cap: DEFAULT_CAPACITY, minutes: 60, earliest: WED, latest: WED });
    assert.deepEqual(before && { date: before.date, time: before.time }, { date: WED, time: "15:30" });
    // After Yes: never inside Wed 4-9 PM or Sat/Sun 8 AM-2 PM.
    const after = placeTask(tasks, { now, cap: DEFAULT_CAPACITY, minutes: 60 });
    assert.ok(after);
    const [h, m] = after.time.split(":").map(Number);
    const start = h * 60 + m;
    const day = new Date(`${after.date}T12:00:00Z`).getUTCDay();
    const inShift = (day === 3 && start < 21 * 60 && 16 * 60 < start + 60) || ((day === 6 || day === 0) && start < 14 * 60 && 8 * 60 < start + 60);
    assert.ok(!inShift, `${after.date} ${after.time} is inside a shift`);
  });
});
