// Run with `npm test`. Same resolve hook as task-kind.test.ts.
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

type Mod = typeof import("./week-lines");
void (import("./week-lines") as Promise<Mod>).then(({ weekLines }) => {
  const task = (over: Record<string, unknown>) => ({ id: "t", title: "x", date: "2026-11-18", time: "16:00", completed: false, ...over }) as never;
  const school = (date: string) =>
    task({ id: `s-${date}`, title: "School", date, time: "08:00", kind: "school", notes: "Until 3:00 PM", recurring: { parentId: "series-1", frequency: "weekly", daysOfWeek: [1, 2, 3, 4, 5] } });

  test("the School block is not counted as something to do (Phase 5 heuristic F01)", () => {
    const tasks = [
      school("2026-11-18"), school("2026-11-19"), school("2026-11-20"), school("2026-11-23"), school("2026-11-24"),
      task({ id: "v", title: "Weekly video upload", date: "2026-11-22", time: "18:00" }),
    ];
    const lines = weekLines(tasks, "2026-11-18");
    assert.equal(lines[0].startsWith("1 thing to do in the next 7 days"), true, lines[0]);
    assert.equal(lines.some((l) => l.startsWith("Busiest")), false);
  });

  test("a week with only school hours reads as empty", () => {
    assert.deepEqual(weekLines([school("2026-11-18"), school("2026-11-19")], "2026-11-18"), ["Nothing on your calendar for the next 7 days."]);
  });
});
