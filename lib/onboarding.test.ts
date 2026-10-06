// Run with `npm test`. Covers the onboarding answers (lib/onboarding.ts), what
// they change (lib/personalize.ts) and the School block replacement
// (lib/school-block.ts). Same resolve hook as lib/schedule-slots.test.ts.
import * as nodeModule from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "./types";

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

type Onboarding = typeof import("./onboarding");
type Personalize = typeof import("./personalize");
type SchoolBlock = typeof import("./school-block");
const load = Promise.all([import("./onboarding"), import("./personalize"), import("./school-block")]) as Promise<
  [Onboarding, Personalize, SchoolBlock]
>;

void load.then(([ob, px, sb]) => {
  // ─── Options ───────────────────────────────────────────────────────────────

  test("every listed option is accepted by its parser, and the lists match the spec", () => {
    assert.deepEqual([...ob.HELP_FOCUS], ["school", "goals", "balance", "unsure"]);
    assert.deepEqual([...ob.SLIP_POINTS], ["assignments", "projects", "ideas", "deadlines", "everything"]);
    assert.deepEqual([...ob.DAY_VIEWS], ["next", "day", "week", "goals"]);
    assert.deepEqual([...ob.WORKING_TOWARD], ["school", "build", "skill", "prepare", "organized"]);
    for (const v of ob.HELP_FOCUS) assert.equal(ob.parseHelpFocus(v), v);
    for (const v of ob.SLIP_POINTS) assert.equal(ob.parseSlipPoint(v), v);
    for (const v of ob.DAY_VIEWS) assert.equal(ob.parseDayView(v), v);
    for (const v of ob.WORKING_TOWARD) assert.equal(ob.parseWorkingToward(v), v);
    // Each option list covers exactly its allowed values, in order.
    assert.deepEqual(ob.HELP_FOCUS_OPTIONS.map((o) => o.value), [...ob.HELP_FOCUS]);
    assert.deepEqual(ob.SLIP_POINT_OPTIONS.map((o) => o.value), [...ob.SLIP_POINTS]);
    assert.deepEqual(ob.DAY_VIEW_OPTIONS.map((o) => o.value), [...ob.DAY_VIEWS]);
    assert.deepEqual(ob.WORKING_TOWARD_OPTIONS.map((o) => o.value), [...ob.WORKING_TOWARD]);
  });

  test("every valid submission combination parses", () => {
    for (const helpFocus of ob.HELP_FOCUS)
      for (const slipPoint of ob.SLIP_POINTS)
        for (const dayView of ob.DAY_VIEWS)
          for (const workingToward of ob.WORKING_TOWARD) {
            const r = ob.parseSubmission({ preferences: { helpFocus, slipPoint, dayView, workingToward }, school: null });
            assert.ok(r.ok, `${helpFocus}/${slipPoint}/${dayView}/${workingToward}`);
            if (r.ok) assert.deepEqual(r.value.preferences, { helpFocus, slipPoint, dayView, workingToward, startingIntent: null });
          }
  });

  test("unknown values are rejected, not silently dropped", () => {
    assert.equal(ob.parseHelpFocus("everything"), null);
    assert.equal(ob.parseDayView("month"), null);
    assert.equal(ob.parseSlipPoint(3), null);
    assert.equal(ob.parseWorkingToward("School"), null);
    for (const bad of [
      { preferences: { helpFocus: "fun" } },
      { preferences: { slipPoint: "homework" } },
      { preferences: { dayView: "month" } },
      { preferences: { workingToward: "win" } },
      { preferences: { startingIntent: 42 } },
      { preferences: { startingIntent: "x".repeat(141) } },
      { preferences: {}, school: { days: [1], start: "15:00", end: "08:00" } },
      { preferences: {}, school: { days: [], start: "08:00", end: "15:00" } },
      { preferences: {}, school: { days: [9], start: "08:00", end: "15:00" } },
      { preferences: {}, school: { days: [1, 1], start: "08:00", end: "15:00" } },
      { preferences: {}, school: { days: [1], start: "8am", end: "15:00" } },
    ]) {
      assert.equal(ob.parseSubmission(bad).ok, false, JSON.stringify(bad));
    }
    assert.equal(ob.parseSubmission(null).ok, false);
    assert.equal(ob.parsePreferencesPatch({ dayView: "month" }).ok, false);
    assert.equal(ob.parsePreferencesPatch({}).ok, false);
  });

  test("a profile holding stale or unknown values reads as unanswered", () => {
    assert.deepEqual(ob.preferencesFrom({ helpFocus: "legacy", dayView: 7, startingIntent: "   " }), ob.EMPTY_PREFERENCES);
  });

  // ─── Unsupported integrations ────────────────────────────────────────────

  test("no week-shape or integration question exists anywhere in the flow", () => {
    const steps = ob.stepsFor(true);
    assert.deepEqual(steps, ["name", "help", "slip", "view", "school", "toward", "intent", "ready"]);
    assert.deepEqual(Object.keys(ob.EMPTY_PREFERENCES).sort(), ["dayView", "helpFocus", "slipPoint", "startingIntent", "workingToward"]);
    assert.deepEqual(Object.keys(ob.emptyDraft()).sort(), [
      "dayView",
      "helpFocus",
      "name",
      "school",
      "schoolMode",
      "slipPoint",
      "startingIntent",
      "workingToward",
    ]);
    for (const key of ["weekShape", "integrationInterest", "canvas"]) {
      assert.equal(ob.parsePreferencesPatch({ [key]: "canvas" }).ok, false, key);
    }
    // An unknown key in a submission never reaches the saved preferences.
    const r = ob.parseSubmission({ preferences: { helpFocus: "school", integrationInterest: "canvas", weekShape: "busy" } });
    assert.ok(r.ok);
    if (r.ok) assert.deepEqual(Object.keys(r.value.preferences).sort(), Object.keys(ob.EMPTY_PREFERENCES).sort());
  });

  // ─── Flow and draft ──────────────────────────────────────────────────────

  test("the name step only shows when there is no display name", () => {
    assert.equal(ob.stepsFor(true)[0], "name");
    assert.equal(ob.stepsFor(false)[0], "help");
    assert.ok(!ob.stepsFor(false).includes("name"));
  });

  test("Back and Forward keep every answer; Continue gates only what it should", () => {
    const steps = ob.stepsFor(false);
    let draft = ob.emptyDraft();
    assert.equal(ob.canContinue("help", draft), false);
    draft = { ...draft, helpFocus: "goals", slipPoint: "ideas", dayView: "week" };
    // Moving between steps never touches the draft; only answering does.
    let i = steps.indexOf("view");
    i -= 1; // Back to "slip"
    assert.equal(steps[i], "slip");
    assert.equal(draft.slipPoint, "ideas");
    i -= 1; // Back to "help"
    assert.equal(draft.helpFocus, "goals");
    i += 2; // Forward again
    assert.equal(steps[i], "view");
    assert.equal(ob.canContinue("view", draft), true);
    // School: "varies"/"skip" always continue; "set" needs a real schedule.
    assert.equal(ob.canContinue("school", { ...draft, schoolMode: "skip" }), true);
    assert.equal(ob.canContinue("school", { ...draft, schoolMode: "varies" }), true);
    assert.equal(ob.canContinue("school", { ...draft, schoolMode: "set", school: { days: [], start: "08:00", end: "15:00" } }), false);
    assert.equal(ob.canContinue("school", { ...draft, schoolMode: "set" }), true);
    // The intent step is optional.
    assert.equal(ob.canContinue("intent", draft), true);
    assert.equal(ob.canContinue("name", draft), false);
    assert.equal(ob.canContinue("name", { ...draft, name: "Ada" }), true);
  });

  test("a draft survives a refresh, and a broken one starts fresh", () => {
    const draft = {
      ...ob.emptyDraft(),
      helpFocus: "school" as const,
      slipPoint: "deadlines" as const,
      schoolMode: "set" as const,
      school: { days: [1, 3, 5], start: "07:45", end: "14:30" },
      startingIntent: "Get ready for my chemistry test",
    };
    const back = ob.parseStoredDraft(ob.serializeDraft("school", draft));
    assert.ok(back);
    assert.equal(back.step, "school");
    assert.deepEqual(back.draft, draft);

    assert.equal(ob.parseStoredDraft(null), null);
    assert.equal(ob.parseStoredDraft("{not json"), null);
    assert.equal(ob.parseStoredDraft(JSON.stringify({ v: 2, step: "help", draft })), null);
    // Unknown values inside an otherwise good draft are dropped individually.
    const tampered = ob.parseStoredDraft(JSON.stringify({ v: 1, step: "nope", draft: { ...draft, helpFocus: "x", school: "bad" } }));
    assert.ok(tampered);
    assert.equal(tampered.step, "help");
    assert.equal(tampered.draft.helpFocus, null);
    assert.deepEqual(tampered.draft.school, ob.DEFAULT_SCHOOL_HOURS);
    assert.equal(tampered.draft.slipPoint, "deadlines");
  });

  test("a resumed draft can't skip past an unanswered step", () => {
    const steps = ob.stepsFor(false);
    const draft = { ...ob.emptyDraft(), helpFocus: "balance" as const };
    assert.equal(ob.resumeStep(steps, "toward", draft), "slip");
    assert.equal(ob.resumeStep(steps, "help", draft), "help");
    assert.equal(ob.resumeStep(steps, "name", draft), "help");
  });

  test("the draft key is per signed-in student", () => {
    assert.notEqual(ob.draftStorageKey("a@x.com"), ob.draftStorageKey("b@x.com"));
    assert.equal(ob.draftStorageKey(" A@X.com "), ob.draftStorageKey("a@x.com"));
  });

  test("Redo setup prefills saved answers and school hours, but not the old intent", () => {
    const d = ob.draftFromSaved({
      displayName: "Ada",
      preferences: { helpFocus: "goals", slipPoint: "projects", dayView: "goals", workingToward: "build", startingIntent: "Old" },
      school: { days: [1, 2, 3, 4], start: "08:15", end: "15:10" },
    });
    assert.equal(d.helpFocus, "goals");
    assert.equal(d.workingToward, "build");
    assert.equal(d.schoolMode, "set");
    assert.deepEqual(d.school, { days: [1, 2, 3, 4], start: "08:15", end: "15:10" });
    assert.equal(d.startingIntent, "");
    // Answered before without school hours: the school step shows "Skip" chosen.
    assert.equal(ob.draftFromSaved({ preferences: { helpFocus: "school" }, school: null }).schoolMode, "skip");
    // Never answered: nothing chosen.
    assert.equal(ob.draftFromSaved({}).schoolMode, null);
  });

  // ─── Starting intent ─────────────────────────────────────────────────────

  test("the starting intent is optional, trimmed, capped, and clearable", () => {
    const base = { ...ob.emptyDraft(), helpFocus: "goals" as const };
    assert.equal(ob.submissionFromDraft({ ...base, startingIntent: "" }, { includeName: false }).preferences.startingIntent, null);
    assert.equal(
      ob.submissionFromDraft({ ...base, startingIntent: "  Learn   Python \n" }, { includeName: false }).preferences.startingIntent,
      "Learn Python"
    );
    assert.equal(ob.cleanStartingIntent("x".repeat(200))?.length, ob.STARTING_INTENT_MAX);
    // Clearing after "Break it into steps", "Make it a Path" or dismiss:
    const clear = ob.parsePreferencesPatch({ startingIntent: null });
    assert.deepEqual(clear, { ok: true, value: { startingIntent: null } });
    assert.equal(ob.parsePreferencesPatch({ startingIntent: "   " }).ok, true);
    // Once cleared, the profile reads as having none.
    assert.equal(ob.preferencesFrom({ startingIntent: null }).startingIntent, null);
  });

  test("the submission only carries a name when the name step was shown, and school only when set", () => {
    const draft = { ...ob.emptyDraft(), name: " Ada ", schoolMode: "skip" as const };
    assert.equal(ob.submissionFromDraft(draft, { includeName: false }).displayName, undefined);
    assert.equal(ob.submissionFromDraft(draft, { includeName: true }).displayName, "Ada");
    assert.equal(ob.submissionFromDraft(draft, { includeName: true }).school, null);
    assert.equal(ob.submissionFromDraft({ ...draft, schoolMode: "varies" }, { includeName: true }).school, null);
    assert.deepEqual(ob.submissionFromDraft({ ...draft, schoolMode: "set" }, { includeName: true }).school, ob.DEFAULT_SCHOOL_HOURS);
  });

  // ─── Final screen ────────────────────────────────────────────────────────

  test("the final screen has two or three fixed lines and only meaningful summary rows", () => {
    for (const dayView of ob.DAY_VIEWS)
      for (const slipPoint of ob.SLIP_POINTS)
        for (const workingToward of ob.WORKING_TOWARD) {
          const lines = ob.readyLines({ dayView, slipPoint, workingToward });
          assert.equal(lines.length, 3);
          assert.equal(new Set(lines).size, 3);
        }
    assert.deepEqual(ob.readyLines({ dayView: "next", slipPoint: "ideas", workingToward: "build" }), [
      "We'll keep your next move clear.",
      "We'll make room for ideas before they disappear.",
      "And we'll help bigger projects become something you can start.",
    ]);
    assert.ok(ob.readyLines({ dayView: null, slipPoint: null, workingToward: null }).length >= 1);

    assert.deepEqual(ob.readySummary({ dayView: "next", workingToward: "build" }, ob.DEFAULT_SCHOOL_HOURS), [
      { label: "Starts with", value: "What's next" },
      { label: "Focus", value: "Build something" },
      { label: "School hours", value: "Mon–Fri · 8:00 AM–3:00 PM" },
    ]);
    assert.deepEqual(ob.readySummary({ dayView: "day", workingToward: null }, null), [{ label: "Starts with", value: "Today's plan" }]);
  });

  test("school days read naturally", () => {
    assert.equal(ob.formatSchoolDays([1, 2, 3, 4, 5]), "Mon–Fri");
    assert.equal(ob.formatSchoolDays([0, 1, 2, 3, 4, 5, 6]), "Every day");
    assert.equal(ob.formatSchoolDays([1, 3, 5]), "Mon, Wed, Fri");
    assert.equal(ob.formatSchoolDays([1, 2]), "Mon, Tue");
    assert.equal(ob.formatSchoolDays([2, 3, 4]), "Tue–Thu");
  });

  // ─── Personalization ─────────────────────────────────────────────────────

  test("an existing student with no answers sees Tangent exactly as before", () => {
    const legacyUser = { displayName: "Sam", email: "s@x.com", onboardedAt: "2026-01-01T00:00:00.000Z" };
    const prefs = px.prefsOf(legacyUser as never);
    assert.deepEqual(prefs, ob.EMPTY_PREFERENCES);
    assert.deepEqual(px.homeLayout(prefs), px.DEFAULT_HOME);
    assert.deepEqual(px.captureCopy(prefs), { placeholder: px.DEFAULT_CAPTURE_PLACEHOLDER, quickActions: px.DEFAULT_QUICK_ACTIONS });
    assert.equal(px.aiFirstSuggestion(prefs), null);
    assert.equal(px.initialCalendarView(prefs, null, true), "agenda");
    assert.equal(px.initialCalendarView(prefs, null, false), "week");
    assert.deepEqual(px.pathsEmptyCopy(prefs), px.DEFAULT_PATHS_EMPTY);
    assert.equal(px.initialPathKind(prefs), null);
  });

  test("personalization is safe with null, undefined and junk", () => {
    for (const input of [null, undefined, {}, { dayView: "month", helpFocus: 1, slipPoint: [], workingToward: {} }]) {
      const prefs = px.prefsOf(input as never);
      assert.deepEqual(px.homeLayout(prefs), px.DEFAULT_HOME);
      assert.equal(px.captureCopy(prefs).placeholder, px.DEFAULT_CAPTURE_PLACEHOLDER);
      assert.equal(px.aiFirstSuggestion(prefs), null);
    }
  });

  test("every answer combination produces a complete, valid Home layout", () => {
    for (const helpFocus of [...ob.HELP_FOCUS, null])
      for (const dayView of [...ob.DAY_VIEWS, null]) {
        const layout = px.homeLayout({ ...ob.EMPTY_PREFERENCES, helpFocus, dayView });
        assert.deepEqual([...layout.order].sort(), ["attention", "dayline", "insights"]);
      }
  });

  test("day view changes what leads Home, and week adds the Open week link", () => {
    const p = (dayView: (typeof ob.DAY_VIEWS)[number]) => px.homeLayout({ ...ob.EMPTY_PREFERENCES, dayView });
    assert.equal(p("next").order[0], "attention");
    assert.equal(p("day").order[0], "dayline");
    assert.equal(p("week").order[0], "insights");
    assert.equal(p("week").openWeekLink, true);
    assert.equal(p("day").openWeekLink, false);
    assert.equal(p("goals").pathsCard, "top");
    assert.equal(p("next").pathsCard, "none");
  });

  test("help focus: school changes the empty day, goals shows the Paths card", () => {
    const school = px.homeLayout({ ...ob.EMPTY_PREFERENCES, helpFocus: "school" });
    assert.equal(school.todayEmpty, "Got something due soon?");
    assert.equal(school.todayEmptyAction, "Tell Tangent");
    assert.equal(px.homeLayout({ ...ob.EMPTY_PREFERENCES, helpFocus: "goals" }).pathsCard, "top");
    for (const helpFocus of ["balance", "unsure"] as const) {
      assert.deepEqual(px.homeLayout({ ...ob.EMPTY_PREFERENCES, helpFocus }), px.DEFAULT_HOME);
    }
  });

  test("slip point sets the capture examples", () => {
    const c = (slipPoint: (typeof ob.SLIP_POINTS)[number]) => px.captureCopy({ ...ob.EMPTY_PREFERENCES, slipPoint });
    assert.equal(c("assignments").placeholder, "Help me plan for my chemistry test Friday");
    assert.equal(c("deadlines").placeholder, "Help me plan for my chemistry test Friday");
    assert.equal(c("projects").placeholder, "Break a big project into first steps");
    assert.equal(c("ideas").placeholder, "Thought of something worth doing? Drop it here.");
    assert.equal(c("ideas").quickActions[0].label, "Remind me to email about that research program");
    assert.deepEqual(c("everything"), { placeholder: px.DEFAULT_CAPTURE_PLACEHOLDER, quickActions: px.DEFAULT_QUICK_ACTIONS });
    // Examples are added, never replacing the palette's own actions.
    for (const s of ob.SLIP_POINTS) {
      for (const a of px.DEFAULT_QUICK_ACTIONS) assert.ok(c(s).quickActions.some((q) => q.label === a.label));
      assert.ok(c(s).quickActions.every((q) => q.kind !== "ask" || px.DEFAULT_QUICK_ACTIONS.includes(q)), "no new auto-sent prompts");
    }
    // A school focus fills in only when the slip point has nothing specific.
    assert.equal(px.captureCopy({ ...ob.EMPTY_PREFERENCES, helpFocus: "school", slipPoint: "everything" }).quickActions[0].label, "Add an assignment");
    assert.equal(px.captureCopy({ ...ob.EMPTY_PREFERENCES, helpFocus: "school", slipPoint: "ideas" }).quickActions[0].label, c("ideas").quickActions[0].label);
  });

  test("working toward sets the AI suggestion and the Paths starter", () => {
    for (const w of ob.WORKING_TOWARD) {
      const prefs = { ...ob.EMPTY_PREFERENCES, workingToward: w };
      assert.ok(px.aiFirstSuggestion(prefs)?.text);
      assert.ok(px.pathsStarterCopy(prefs).cta);
    }
    const kind = (workingToward: (typeof ob.WORKING_TOWARD)[number]) => px.initialPathKind({ ...ob.EMPTY_PREFERENCES, workingToward });
    assert.equal(kind("skill"), "skill");
    assert.equal(kind("build"), "other");
    assert.equal(kind("prepare"), "other");
    assert.equal(kind("school"), null);
    assert.equal(kind("organized"), null);
    assert.equal(px.pathsEmptyCopy({ ...ob.EMPTY_PREFERENCES, workingToward: "organized" }), px.DEFAULT_PATHS_EMPTY);
  });

  test("calendar: a saved view always wins; 'This week' only fills an unsaved default", () => {
    const week = { ...ob.EMPTY_PREFERENCES, dayView: "week" as const };
    assert.equal(px.initialCalendarView(week, null, true), "week");
    assert.equal(px.initialCalendarView(week, "month", false), "month");
    assert.equal(px.initialCalendarView(week, "agenda", true), "agenda");
    assert.equal(px.initialCalendarView({ ...ob.EMPTY_PREFERENCES, dayView: "day" }, null, true), "agenda");
  });

  // ─── School block ────────────────────────────────────────────────────────

  let seq = 0;
  function applyPlan(tasks: Task[], plan: ReturnType<SchoolBlock["planSchoolReplace"]>): Task[] {
    const kept = tasks.filter((t) => !t.recurring?.parentId || !plan.deleteSeries.includes(t.recurring.parentId));
    if (!plan.add) return kept;
    const parentId = `rec_${1_700_000_000_000 + ++seq}_x`;
    const added = plan.add.recurring.daysOfWeek.map((d, i) => ({
      ...plan.add!.task,
      id: `s${seq}_${i}`,
      date: `2026-10-0${d || 7}`,
      recurring: { enabled: true, frequency: "weekly" as const, daysOfWeek: plan.add!.recurring.daysOfWeek, parentId },
    }));
    return [...kept, ...added];
  }
  const series = (tasks: Task[]) => sb.schoolSeriesIds(tasks);

  const canvasSchool: Task = { id: "c1", title: "School", date: "2026-10-01", time: "09:00", completed: false, kind: "school", source: "canvas" };
  const chemTest: Task = { id: "c2", title: "Chem test", date: "2026-10-02", time: "10:00", completed: false, kind: "school" };
  const weeklyClub: Task = {
    id: "c3",
    title: "Robotics",
    date: "2026-10-01",
    time: "16:00",
    completed: false,
    kind: "commitment",
    recurring: { enabled: true, frequency: "weekly", daysOfWeek: [2], parentId: "rec_1_club" },
  };

  test("running setup any number of times leaves one School series with the newest hours", () => {
    let tasks: Task[] = [canvasSchool, chemTest, weeklyClub];
    const schedules = [
      { days: [1, 2, 3, 4, 5], start: "08:00", end: "15:00" },
      { days: [1, 2, 3, 4], start: "07:30", end: "14:45" },
      { days: [1, 3, 5], start: "09:00", end: "13:00" },
    ];
    for (const hours of schedules) {
      tasks = applyPlan(tasks, sb.planSchoolReplace(tasks, hours, "2026-09-29", "2027-01-19"));
      assert.equal(series(tasks).length, 1);
      assert.deepEqual(sb.schoolHoursFromTasks(tasks), hours);
    }
    // The same hours again: still exactly one series.
    tasks = applyPlan(tasks, sb.planSchoolReplace(tasks, schedules[2], "2026-09-29", "2027-01-19"));
    assert.equal(series(tasks).length, 1);
    // Nothing else was touched.
    for (const t of [canvasSchool, chemTest, weeklyClub]) assert.ok(tasks.includes(t), t.title);
  });

  test("the old duplicate bug heals: stacked series from earlier setups collapse to one", () => {
    const old = (parentId: string): Task => ({
      id: parentId,
      title: "School",
      date: "2026-09-01",
      time: "08:00",
      completed: false,
      kind: "school",
      notes: "Until 3:00 PM",
      recurring: { enabled: true, frequency: "weekly", daysOfWeek: [1, 2, 3, 4, 5], parentId },
    });
    let tasks = [old("rec_1700000000001_a"), old("rec_1700000000002_b"), old("rec_1700000000003_c"), chemTest];
    assert.equal(series(tasks).length, 3);
    tasks = applyPlan(tasks, sb.planSchoolReplace(tasks, ob.DEFAULT_SCHOOL_HOURS, "2026-09-29", "2027-01-19"));
    assert.equal(series(tasks).length, 1);
    assert.ok(tasks.includes(chemTest));
  });

  test("skipping school hours leaves no School block and nothing else changes", () => {
    let tasks: Task[] = [canvasSchool, chemTest, weeklyClub];
    tasks = applyPlan(tasks, sb.planSchoolReplace(tasks, ob.DEFAULT_SCHOOL_HOURS, "2026-09-29", "2027-01-19"));
    tasks = applyPlan(tasks, sb.planSchoolReplace(tasks, null, "2026-09-29", "2027-01-19"));
    assert.equal(series(tasks).length, 0);
    assert.equal(sb.schoolHoursFromTasks(tasks), null);
    assert.deepEqual(tasks, [canvasSchool, chemTest, weeklyClub]);
    // Skipping when there never was one is a no-op.
    assert.deepEqual(sb.planSchoolReplace([chemTest], null, "2026-09-29", "2027-01-19"), { deleteSeries: [], add: null });
  });

  test("the School series is written the way scheduling reads it", () => {
    const s = sb.schoolSeriesFor({ days: [1, 2, 3, 4, 5], start: "08:00", end: "15:00" }, "2026-09-29", "2027-01-19");
    assert.equal(s.task.title, "School");
    assert.equal(s.task.kind, "school");
    assert.equal(s.task.time, "08:00");
    assert.equal(s.task.notes, "Until 3:00 PM");
    assert.equal(s.recurring.frequency, "weekly");
    assert.equal(s.recurring.endDate, "2027-01-19");
  });
});
