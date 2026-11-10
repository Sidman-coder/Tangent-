// Run with `npm test`. Covers the onboarding answers (lib/onboarding.ts), the
// facts they become (lib/onboarding-facts.ts), what
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
type Facts = typeof import("./onboarding-facts");
const load = Promise.all([
  import("./onboarding"),
  import("./personalize"),
  import("./school-block"),
  import("./onboarding-facts"),
]) as Promise<[Onboarding, Personalize, SchoolBlock, Facts]>;

void load.then(([ob, px, sb, facts]) => {
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

  // ─── The eight questions (Round 4 Phase 6) ─────────────────────────────────

  const SCHOOL = {
    kind: "school" as const,
    name: "School",
    repeat: { kind: "weekdays" as const },
    blocks: [{ days: [1, 2, 3, 4, 5], start: "08:00", end: "15:00" }],
  };

  const full = (): ReturnType<typeof ob.emptyDraft> => ({
    ...ob.emptyDraft(),
    name: "Maya",
    grade: "10",
    commitments: [SCHOOL],
    matters: ["ap", "project"],
    mattersText: "Getting my driver's license",
    slips: ["putOff", "freeze"],
    bugging: "Finish my robotics proposal",
    bestTime: "evenings",
    focusLength: "45",
    schoolNightHours: "2",
    toward: { major: "Computer science", career: "engineer", dream: "Build a rover", notSure: false },
    push: "straight",
    more: { brain: "Music helps me focus", push: "" },
  });

  test("the new answer lists match their parsers and options", () => {
    const pairs: [readonly string[], (v: unknown) => string | null, { value: string }[]][] = [
      [ob.GRADES, ob.parseGrade, ob.GRADE_OPTIONS],
      [ob.MATTERS, ob.parseMatter, ob.MATTER_OPTIONS],
      [ob.SLIPS, ob.parseSlip, ob.SLIP_OPTIONS],
      [ob.BEST_TIMES, ob.parseBestTime, ob.BEST_TIME_OPTIONS],
      [ob.FOCUS_LENGTHS, ob.parseFocusLength, ob.FOCUS_LENGTH_OPTIONS],
      [ob.SCHOOL_NIGHT_HOURS, ob.parseSchoolNightHours, ob.SCHOOL_NIGHT_OPTIONS],
      [ob.PUSH_STYLES, ob.parsePushStyle, ob.PUSH_OPTIONS],
    ];
    for (const [list, parse, options] of pairs) {
      for (const v of list) assert.equal(parse(v), v);
      assert.equal(parse("nope"), null);
      assert.deepEqual(options.map((o) => o.value), [...list]);
    }
  });

  test("eight questions, then the ready screen, and none of them asks about week shape or integrations", () => {
    assert.deepEqual(ob.STEPS, ["about", "busy", "matters", "slip", "bugging", "brain", "toward", "push", "ready"]);
    assert.equal(ob.QUESTION_STEPS.length, 8);
    const keys = Object.keys(ob.emptyDraft()).join(" ").toLowerCase();
    for (const banned of ["weekshape", "integration", "canvas", "google", "notion"]) assert.ok(!keys.includes(banned), banned);
  });

  test("only the name is required; a half-filled commitment blocks Continue", () => {
    const d = ob.emptyDraft();
    assert.equal(ob.canContinue("about", d), false);
    assert.equal(ob.canContinue("about", { ...d, name: "  " }), false);
    assert.equal(ob.canContinue("about", { ...d, name: "Maya" }), true);
    for (const step of ob.QUESTION_STEPS.filter((s) => s !== "about")) assert.equal(ob.canContinue(step, d), true, step);
    const broken = { ...SCHOOL, blocks: [{ days: [], start: "08:00", end: "15:00" }] };
    assert.equal(ob.canContinue("busy", { ...d, commitments: [broken] }), false);
    assert.equal(ob.canContinue("busy", { ...d, commitments: [SCHOOL] }), true);
  });

  test("Skip turns into Continue once a step has any answer, including Tell me more", () => {
    const d = ob.emptyDraft();
    for (const step of ob.QUESTION_STEPS) assert.equal(ob.hasAnswer(step, d), false, step);
    for (const step of ob.QUESTION_STEPS.filter((s) => s !== "about")) {
      assert.equal(ob.hasAnswer(step, { ...d, more: { [step]: "something real" } }), true, step);
    }
    assert.equal(ob.hasAnswer("matters", { ...d, mattersText: "chess" }), true);
    assert.equal(ob.hasAnswer("toward", { ...d, toward: { ...d.toward, notSure: true } }), true);
    assert.equal(ob.hasAnswer("brain", { ...d, focusLength: "30" }), true);
    assert.equal(ob.hasAnswer("bugging", { ...d, bugging: "   " }), false);
  });

  test("slips: up to two, and a third pick replaces the oldest", () => {
    let s = ob.toggleSlip([], "forget");
    s = ob.toggleSlip(s, "fade");
    assert.deepEqual(s, ["forget", "fade"]);
    assert.deepEqual(ob.toggleSlip(s, "perfect"), ["fade", "perfect"]);
    assert.deepEqual(ob.toggleSlip(s, "forget"), ["fade"]);
  });

  test("a draft survives a refresh; an old or broken one starts fresh; bad fields drop one by one", () => {
    const d = full();
    const back = ob.parseStoredDraft(ob.serializeDraft("brain", d));
    assert.ok(back);
    assert.equal(back.step, "brain");
    assert.deepEqual(back.draft, { ...d, more: { brain: "Music helps me focus" } });

    assert.equal(ob.parseStoredDraft(JSON.stringify({ v: 1, step: "intent", draft: {} })), null);
    assert.equal(ob.parseStoredDraft("{not json"), null);
    assert.equal(ob.parseStoredDraft(null), null);

    const tampered = JSON.parse(ob.serializeDraft("nowhere" as never, d));
    tampered.draft.grade = "13";
    tampered.draft.slips = ["forget", "bogus", "fade", "freeze"];
    tampered.draft.push = 7;
    tampered.draft.more = { brain: "ok", sneaky: "x" };
    const t = ob.parseStoredDraft(JSON.stringify(tampered));
    assert.ok(t);
    assert.equal(t.step, "about");
    assert.equal(t.draft.grade, null);
    assert.deepEqual(t.draft.slips, ["forget", "fade"]);
    assert.equal(t.draft.push, null);
    assert.deepEqual(t.draft.more, { brain: "ok" });
    assert.equal(t.draft.name, "Maya");
  });

  test("a resumed draft can't land past a step it can't continue from", () => {
    const d = ob.emptyDraft();
    assert.equal(ob.resumeStep("push", d), "about");
    assert.equal(ob.resumeStep("push", { ...d, name: "Maya" }), "push");
    assert.equal(ob.resumeStep("ready", full()), "ready");
  });

  test("Redo setup keeps the name and day view; the calendar stays put until commitments load", () => {
    const d = ob.draftFromSaved({ displayName: " Maya ", preferences: { dayView: "week", helpFocus: "school" }, onboarded: true });
    assert.equal(d.name, "Maya");
    assert.equal(d.dayView, "week");
    assert.equal(d.commitmentsKnown, false);
    assert.equal(d.grade, null);
    assert.equal(ob.submissionFromDraft(d).answers.commitments, null);
    const fresh = ob.draftFromSaved({ displayName: "", onboarded: false });
    assert.deepEqual(ob.submissionFromDraft(fresh).answers.commitments, []);
  });

  test("the submission keeps the older answers working and round-trips through the server check", () => {
    const sub = ob.submissionFromDraft(full(), { timezone: "America/Chicago" });
    assert.equal(sub.displayName, "Maya");
    assert.equal(sub.timezone, "America/Chicago");
    assert.deepEqual(sub.preferences, {
      helpFocus: "balance",
      slipPoint: "deadlines",
      dayView: null,
      workingToward: "school",
      startingIntent: "Finish my robotics proposal",
    });
    assert.deepEqual(sub.answers.more, { brain: "Music helps me focus" });
    const parsed = ob.parseSubmission(JSON.parse(JSON.stringify(sub)));
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value, sub);
  });

  test("the server rejects unknown or oversized answers", () => {
    const base = JSON.parse(JSON.stringify(ob.submissionFromDraft(full())));
    const bad = (mutate: (b: Record<string, Record<string, unknown>>) => void) => {
      const b = JSON.parse(JSON.stringify(base));
      mutate(b);
      return ob.parseSubmission(b).ok;
    };
    assert.equal(bad(() => {}), true);
    assert.equal(bad((b) => (b.answers.grade = "13")), false);
    assert.equal(bad((b) => (b.answers.slips = ["forget", "fade", "freeze"])), false);
    assert.equal(bad((b) => (b.answers.matters = ["grades", "nap"])), false);
    assert.equal(bad((b) => (b.answers.push = "shove")), false);
    assert.equal(bad((b) => (b.answers.bugging = "x".repeat(ob.STARTING_INTENT_MAX + 1))), false);
    assert.equal(bad((b) => ((b.answers.toward as Record<string, unknown>).major = "x".repeat(ob.SHORT_TEXT_MAX + 1))), false);
    assert.equal(bad((b) => (b.answers.more = { sneaky: "x" })), false);
    assert.equal(bad((b) => (b.answers.more = { brain: "x".repeat(ob.MORE_MAX + 1) })), false);
    assert.equal(bad((b) => (b.answers.commitments = Array.from({ length: 13 }, () => SCHOOL))), false);
    assert.equal(bad((b) => (b.answers.commitments = [{ name: "?" }])), false);
    assert.equal(bad((b) => (b.preferences.dayView = "month")), false);
    assert.equal(ob.parseSubmission(null).ok, false);
    assert.equal(ob.parseSubmission({ preferences: {} }).ok, false);
  });

  test("distress never becomes a plan, a 'First up' line, or a fact", () => {
    const d = { ...full(), bugging: "honestly I want to die" };
    const sub = ob.submissionFromDraft(d);
    assert.equal(sub.preferences.startingIntent, null);
    assert.equal(ob.intentFrom(d.bugging), null);
    assert.ok(!ob.readyLines(sub.answers).some((l) => l.startsWith("First up")));
    assert.ok(!facts.onboardingFacts(sub.answers).some((f) => f.slotKey === "onbBugging"));
    const more = facts.onboardingFacts({ ...sub.answers, more: { brain: "I can't go on like this" } });
    assert.ok(!more.some((f) => f.slotKey === "onbMoreBrain"));
  });

  test("the ready screen: fixed lines from the answers, and only rows that say something", () => {
    const a = ob.answersFromDraft(full());
    assert.deepEqual(ob.readyLines(a), [
      "We'll start big things early, in small pieces.",
      "We'll tell you straight when you're falling behind.",
      "First up: Finish my robotics proposal. We'll plan it together on Home.",
    ]);
    assert.deepEqual(ob.readyLines({ slips: [], push: null, bugging: "Study for chem." }), [
      "First up: Study for chem. We'll plan it together on Home.",
    ]);
    assert.deepEqual(ob.readyLines({ slips: [], push: null, bugging: null }), ["We'll keep your next move clear."]);
    assert.deepEqual(ob.readySummary(a), [
      { label: "Busy with", value: "School" },
      { label: "Works best", value: "Evenings · 45 min at a time" },
      { label: "School nights", value: "2 hours" },
      { label: "Push", value: "Straight-up accountability" },
    ]);
    assert.deepEqual(ob.readySummary(ob.answersFromDraft(ob.emptyDraft())), []);
  });

  // ─── Onboarding → said facts ─────────────────────────────────────────────

  test("every answer becomes a fact in the student's own terms", () => {
    const out = facts.onboardingFacts(ob.answersFromDraft(full()));
    const by = (key: string) => out.filter((f) => f.slotKey === key).map((f) => f.fact);
    assert.deepEqual(by("onbGrade"), ["You're in 10th grade"]);
    assert.equal(by("onbBusy").length, 1);
    assert.match(by("onbBusy")[0], /^You're busy with School: /);
    assert.deepEqual(by("onbMatters"), ["This year you care most about AP exams and a personal project"]);
    assert.deepEqual(by("onbMattersText"), ["Also on your list this year: Getting my driver's license"]);
    assert.deepEqual(by("onbSlip"), ["You put things off until the last minute", "When there's too much, you freeze"]);
    assert.deepEqual(by("onbBugging"), ["On your mind right now: Finish my robotics proposal"]);
    assert.deepEqual(by("preferredWorkTimes"), ["You do your best work in the evening"]);
    assert.deepEqual(by("focusLength"), ["You can focus for about 45 minutes at a time"]);
    assert.deepEqual(by("onbSchoolNight"), ["You can handle about 2 hours of work on a school night"]);
    assert.deepEqual(by("onbTowardMajor"), ["You're thinking about majoring in Computer science"]);
    assert.deepEqual(by("onbTowardCareer"), ["You'd like to work as an engineer"]);
    assert.deepEqual(by("onbTowardDream"), ["Your dream: Build a rover"]);
    assert.deepEqual(by("onbTowardOpen"), []);
    assert.deepEqual(by("onbPush"), ["You want straight-up accountability"]);
    assert.deepEqual(by("onbMoreBrain"), ["Music helps me focus"]);
    for (const f of out) {
      assert.match(f.slotKey, /^[a-zA-Z]{1,32}$/);
      assert.ok(f.factCategory && f.category, f.slotKey);
    }
  });

  test("fact wording edge cases", () => {
    const a = ob.answersFromDraft(ob.emptyDraft());
    assert.deepEqual(facts.onboardingFacts(a), []);
    const one = (patch: Partial<typeof a>) => facts.onboardingFacts({ ...a, ...patch }).map((f) => f.fact);
    assert.deepEqual(one({ grade: "other" }), ["You're in high school, but not in grades 9 to 12"]);
    assert.deepEqual(one({ focusLength: "60" }), ["You can focus for an hour or more at a time"]);
    assert.deepEqual(one({ schoolNightHours: "1" }), ["You can handle about 1 hour of work on a school night"]);
    assert.deepEqual(one({ schoolNightHours: "4" }), ["You can handle 4 or more hours of work on a school night"]);
    assert.deepEqual(one({ matters: ["sat", "grades", "money"] }), [
      "This year you care most about SAT/ACT, grades and money or a job",
    ]);
    assert.deepEqual(one({ toward: { major: null, career: "a nurse", dream: null, notSure: false } }), [
      "You'd like to work as a nurse",
    ]);
    assert.deepEqual(one({ toward: { major: null, career: "teacher", dream: null, notSure: true } }), [
      "You'd like to work as a teacher",
    ]);
    assert.deepEqual(one({ toward: { major: null, career: null, dream: null, notSure: true } }), [
      "You're still figuring out what you're building toward, and that's fine",
    ]);
    // Vague answers carry nothing to plan with.
    assert.deepEqual(one({ mattersText: "idk", bugging: "stuff", more: { slip: "nothing" } }), []);
  });

  test("onboarding fills the planner's work-time and focus slots in the shape it reads", () => {
    assert.deepEqual(facts.onboardingSlots({ bestTime: null, focusLength: null }), {});
    assert.deepEqual(facts.onboardingSlots({ bestTime: "lateNight", focusLength: "60" }), {
      preferredWorkTimes: ["late night"],
      focusLength: "1 hr",
    });
    assert.deepEqual(facts.onboardingSlots({ bestTime: "afterSchool", focusLength: "15" }), {
      preferredWorkTimes: ["after school"],
      focusLength: "15 min",
    });
  });

  test("a profile holding stale or unknown values reads as unanswered", () => {
    assert.deepEqual(ob.preferencesFrom({ helpFocus: "legacy", dayView: 7, startingIntent: "   " }), ob.EMPTY_PREFERENCES);
  });

  test("the draft key is per signed-in student", () => {
    assert.notEqual(ob.draftStorageKey("a@x.com"), ob.draftStorageKey("b@x.com"));
    assert.equal(ob.draftStorageKey(" A@X.com "), ob.draftStorageKey("a@x.com"));
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
