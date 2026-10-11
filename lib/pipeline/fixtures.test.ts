// Run with `npm test`. The B6 fixtures (lib/pipeline/fixtures/requests.json)
// checked WITHOUT the AI: each case's `router` is the mocked router's reply
// and what intake must then decide, the matcher's decision against the seed,
// the replies to the question it raises (A1), and the clean title (A3). The
// drafted ChangeSets themselves are graded by the real eval, which is not run
// here (`npm run eval:pipeline -- --check` only validates the file).
import * as nodeModule from "node:module";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
type Resolve = (specifier: string, context: unknown, next: (s: string, c: unknown) => unknown) => unknown;
(nodeModule as unknown as { registerHooks: (h: { resolve: Resolve }) => void }).registerHooks({
  resolve(specifier, context, next) {
    let s = specifier;
    if (s.startsWith("@/")) s = pathToFileURL(path.join(ROOT, s.slice(2))).href;
    if ((s.startsWith(".") || s.startsWith("file:")) && !/\.[cm]?[jt]s$/.test(s)) {
      try {
        return next(`${s}.ts`, context);
      } catch {
        /* fall through */
      }
    }
    return next(s, context);
  },
});

type Mods = [
  typeof import("./grade"),
  typeof import("./intent"),
  typeof import("./match"),
  typeof import("../pending-question"),
  typeof import("../quick-add"),
  typeof import("../ai/router"),
];

void (Promise.all([
  import("./grade"),
  import("./intent"),
  import("./match"),
  import("../pending-question"),
  import("../quick-add"),
  import("../ai/router"),
]) as unknown as Promise<Mods>).then(
  ([
    { FixtureFileSchema },
    { classifyIntent, toChangeSetIntent },
    { matchPlan },
    { makePendingQuestion, resolvePendingAnswer, asksForCalendars, NEW_PLAN_ID },
    { cleanTitle },
    { quickCapture },
  ]) => {
    const file = FixtureFileSchema.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures", "requests.json"), "utf8")));
    const TZ = file.timezone;
    const AT = new Date(`${file.reference_date}T14:00:00Z`);
    const routed = file.cases.filter((c) => c.router);

    test("B6: the fixtures cover every case the spec lists", () => {
      const ids = new Set(file.cases.map((c) => c.id));
      for (const id of [
        "transcript-take-out-sat",
        "alias-icf",
        "icf-prep-vs-essay",
        "icf-add-checkpoints-voice",
        "sat-study-session",
        "rename-icf-finals",
        "test-next-week",
        "should-i-schedule",
        "project-robotics-portfolio",
        "tangent-mit",
        "low-confidence-prep",
        "title-soccer-coaching",
      ]) {
        assert.ok(ids.has(id), id);
      }
      assert.ok(routed.length >= 15);
    });

    test("router: the mocked reply decides the route; fast paths never call it", async () => {
      for (const c of routed) {
        const r = c.router!;
        let calls = 0;
        const caller = async () => {
          calls++;
          return {
            intent: r.intent,
            confidence: r.confidence ?? 0.95,
            plan_mention: r.plan_mention ?? null,
            task_mention: null,
            clean_title: null,
            needs_questions: false,
            reason: "fixture",
          };
        };
        const u = await classifyIntent(c.text, { flag: true, tz: TZ, today: file.reference_date, planTitles: c.seed.plans.map((p) => p.title), caller, at: AT });
        assert.equal(u.route, r.route, c.id);
        assert.equal(calls, r.route === "fast" ? 0 : 1, `${c.id}: router calls`);
        if (r.route !== "fast") assert.equal(u.intent, r.intent, c.id);
      }
    });

    test("matcher: sure / unsure / none against the seeded plans and nicknames", () => {
      for (const c of routed.filter((c) => c.router!.match)) {
        const r = c.router!;
        const plans = c.seed.plans.map((p) => ({ id: p.id, title: p.title, aliases: p.aliases, activeAt: p.activeAt }));
        const m = matchPlan(r.plan_mention ?? c.text, plans, AT);
        assert.equal(m.decision, r.match, c.id);
        if (m.decision === "sure") assert.equal(m.target.title, r.match_titles?.[0], c.id);
        if (m.decision === "unsure" && r.match_titles) assert.deepEqual(m.candidates.map((x) => x.title), r.match_titles, c.id);
      }
    });

    test("expected intent agrees with the router: unsure and clarify ask, chat and tangent change nothing", () => {
      for (const c of routed) {
        const r = c.router!;
        const want =
          r.route === "clarify" || r.match === "unsure" ? "clarify" : r.route === "chat" || r.route === "tangent" ? "question" : toChangeSetIntent(r.intent);
        assert.equal(c.expected.intent, want, c.id);
        if (r.match === "sure") assert.ok(c.expected.must_not?.includes("create_plan"), `${c.id}: a sure match never creates a plan`);
      }
    });

    test("A1: replies to the question resolve on their own, never as a calendar list or a new plan", () => {
      for (const c of file.cases.filter((c) => c.pending)) {
        const { kind, answers } = c.pending!;
        const byTitle = new Map(c.seed.plans.map((p) => [p.title, p.id]));
        const titles = c.router?.match_titles ?? c.seed.plans.map((p) => p.title);
        const candidates = titles.map((t) => ({ id: byTitle.get(t)!, title: t }));
        if (kind === "match") candidates.push({ id: NEW_PLAN_ID, title: "New plan" });
        const q = makePendingQuestion(kind, candidates, c.text, AT, { mention: c.router?.plan_mention ?? undefined });
        for (const a of answers) {
          const got = resolvePendingAnswer(a.text, q);
          assert.equal(got.kind, a.resolves, `${c.id}: "${a.text}"`);
          if (got.kind === "pick") assert.deepEqual(got.candidates.map((x) => x.title).sort(), [...(a.picks ?? [])].sort(), `${c.id}: "${a.text}"`);
          assert.equal(asksForCalendars(a.text), false, `${c.id}: "${a.text}" is not a calendar question`);
        }
      }
    });

    test("A3: clean titles, and the time the student said is kept", () => {
      for (const c of file.cases.filter((c) => c.title)) {
        // Capture paths clean what the fast path pulled out (app/api/chat/route.ts,
        // lib/voice-handler.ts); the AI paths clean the model's title (draft.ts).
        const cap = c.no_ai ? quickCapture(c.text, TZ, AT) : null;
        assert.equal(cleanTitle(cap?.title ?? c.text), c.title, c.id);
      }
      const soccer = quickCapture("I have a soccer coaching appointment coming up tomorrow 10pm", TZ, AT);
      assert.equal(soccer?.date, "2026-10-06");
      assert.equal(soccer?.time, "22:00");
    });
  }
);
