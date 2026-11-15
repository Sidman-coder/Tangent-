import test from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./task-span");

void (import("./task-span.ts" as string) as Promise<Mod>).then((m) => {
  test("task-span: a single-date task covers only its date", () => {
    const t = { date: "2026-11-16" };
    assert.equal(m.spanEnd(t), "2026-11-16");
    assert.equal(m.isMultiDay(t), false);
    assert.deepEqual(m.spanDates(t), ["2026-11-16"]);
    assert.equal(m.coversDay(t, "2026-11-17"), false);
    // An end date that isn't after the start counts as single-date.
    assert.equal(m.isMultiDay({ date: "2026-11-16", endDate: "2026-11-16" }), false);
    assert.equal(m.isMultiDay({ date: "2026-11-16", endDate: "2026-11-10" }), false);
  });

  test("task-span: a range task covers every day through its end date, across a month end", () => {
    const t = { date: "2026-11-29", endDate: "2026-12-02" };
    assert.deepEqual(m.spanDates(t), ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
    assert.equal(m.coversDay(t, "2026-12-01"), true);
    assert.equal(m.coversDay(t, "2026-12-03"), false);
    assert.equal(m.coversDay(t, "2026-11-28"), false);
  });

  test("task-span: blockMinutes uses the duration, else the 45-min default", () => {
    assert.equal(m.blockMinutes({}), 45);
    assert.equal(m.blockMinutes({ durationMin: null }), 45);
    assert.equal(m.blockMinutes({ durationMin: 90 }), 90);
    assert.equal(m.blockMinutes({ durationMin: 5 }), 45);
    assert.equal(m.blockMinutes({ durationMin: 5000 }), 1440);
  });

  test("task-span: resizing on the same day sets a snapped length and stays single-date", () => {
    const base = { date: "2026-11-16", startMin: 16 * 60, currentDurationMin: 45, pointerYmd: "2026-11-16" };
    assert.deepEqual(m.resizeTarget({ ...base, pointerMin: 16 * 60 + 100 }), { durationMin: 105, endDate: null });
    // Dragged above the start: never shorter than 15 min.
    assert.deepEqual(m.resizeTarget({ ...base, pointerMin: 15 * 60 }), { durationMin: 15, endDate: null });
    // Never past midnight.
    assert.deepEqual(m.resizeTarget({ ...base, startMin: 23 * 60, pointerMin: 24 * 60 + 200 }), { durationMin: 60, endDate: null });
  });

  test("task-span: resizing into a later day column makes a range task", () => {
    const base = { date: "2026-11-16", startMin: 16 * 60, currentDurationMin: 60 };
    // Pointer after the start time on the later day: the length follows it.
    assert.deepEqual(m.resizeTarget({ ...base, pointerYmd: "2026-11-18", pointerMin: 18 * 60 }), { durationMin: 120, endDate: "2026-11-18" });
    // Pointer before the start time: keep the current length.
    assert.deepEqual(m.resizeTarget({ ...base, pointerYmd: "2026-11-18", pointerMin: 9 * 60 }), { durationMin: 60, endDate: "2026-11-18" });
    // An earlier column counts as the start day.
    assert.equal(m.resizeTarget({ ...base, pointerYmd: "2026-11-15", pointerMin: 17 * 60 }).endDate, null);
  });

  test("task-span: moving a range task shifts its end date by the same number of days", () => {
    assert.equal(m.shiftedEndDate({ date: "2026-11-16", endDate: "2026-11-18" }, "2026-11-20"), "2026-11-22");
    assert.equal(m.shiftedEndDate({ date: "2026-11-16", endDate: "2026-11-18" }, "2026-11-14"), "2026-11-16");
    assert.equal(m.shiftedEndDate({ date: "2026-11-16" }, "2026-11-20"), null);
  });

  test("task-span: request checks", () => {
    assert.equal(m.spanFieldError({ date: "2026-11-16", endDate: "2026-11-18", durationMin: 90 }), null);
    assert.equal(m.spanFieldError({ date: "2026-11-16", endDate: null, durationMin: null }), null);
    assert.match(m.spanFieldError({ date: "2026-11-16", endDate: "2026-11-15" }) ?? "", /before the start/);
    assert.match(m.spanFieldError({ endDate: "soon" }) ?? "", /YYYY-MM-DD/);
    assert.match(m.spanFieldError({ durationMin: 10 }) ?? "", /between/);
    assert.match(m.spanFieldError({ durationMin: 30.5 }) ?? "", /whole minutes/);
    assert.match(m.spanFieldError({ date: "2026-11-16", endDate: "2027-06-01" }) ?? "", /at most/);
  });

  test("task-span: formatDuration", () => {
    assert.equal(m.formatDuration(45), "45 min");
    assert.equal(m.formatDuration(60), "1 hr");
    assert.equal(m.formatDuration(90), "1 hr 30 min");
  });
});
