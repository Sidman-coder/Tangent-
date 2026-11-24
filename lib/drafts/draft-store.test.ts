import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./draft-store");
type Entry = import("./draft-store").DraftEntry;

void (import("./draft-store.ts" as string) as Promise<Mod>).then(({ EMPTY, upsertDraft, acceptPending, removeDraft, visibleDrafts, parseDrafts, isPlanDraft, draftTitle, settleDrafts, hideDraft }) => {
  const entry = (id: string, createdAt: string): Entry =>
    ({
      id,
      title: `Plan ${id}`,
      stepCount: 3,
      origin: "/",
      createdAt,
      changeSet: { id, ops: [], summary: "" },
      preview: { lines: [], likelyDuplicates: [] },
    }) as unknown as Entry;

  test("up to 2 drafts stack; a third waits until the student says Replace", () => {
    let s = upsertDraft(EMPTY, entry("a", "2026-11-14T10:00:00Z"));
    s = upsertDraft(s, entry("b", "2026-11-14T11:00:00Z"));
    assert.equal(s.drafts.length, 2);
    s = upsertDraft(s, entry("c", "2026-11-14T12:00:00Z"));
    assert.deepEqual(s.drafts.map((d: { id: string }) => d.id), ["a", "b"]);
    assert.equal(s.pending!.id, "c");
    const { state, dropped } = acceptPending(s);
    assert.equal(dropped!.id, "a", "the oldest is replaced");
    assert.deepEqual(state.drafts.map((d: { id: string }) => d.id), ["b", "c"]);
    assert.equal(state.pending, null);
  });

  test("declining the third keeps the two; the same draft again refreshes in place", () => {
    let s = upsertDraft(upsertDraft(EMPTY, entry("a", "1")), entry("b", "2"));
    s = upsertDraft(s, entry("c", "3"));
    s = removeDraft(s, "c");
    assert.equal(s.pending, null);
    assert.equal(s.drafts.length, 2);
    s = upsertDraft(s, { ...entry("a", "9"), title: "Renamed" });
    assert.equal(s.drafts.length, 2);
    assert.equal(s.drafts[0].title, "Renamed");
    assert.equal(s.drafts[0].createdAt, "1", "keeps its place in line");
  });

  test("the pill hides a draft that's open on screen", () => {
    const s = upsertDraft(upsertDraft(EMPTY, entry("a", "1")), entry("b", "2"));
    assert.deepEqual(visibleDrafts(s, new Set(["a"])).map((d: { id: string }) => d.id), ["b"]);
  });

  test("overnight 2 (Sam sim): the pill stops offering a draft the server would refuse as expired", () => {
    const now = Date.parse("2026-11-22T20:00:00Z");
    const aged = (id: string, made: string): Entry => {
      const e = entry(id, made);
      return { ...e, changeSet: { ...e.changeSet, created_at: made } } as Entry;
    };
    const s = upsertDraft(upsertDraft(EMPTY, aged("old", "2026-11-21T19:59:00Z")), aged("fresh", "2026-11-22T08:00:00Z"));
    assert.deepEqual(visibleDrafts(s, new Set(), now).map((d: { id: string }) => d.id), ["fresh"], "older than 24 h is hidden");
    const unknown = upsertDraft(EMPTY, entry("u", "x"));
    assert.equal(visibleDrafts(unknown, new Set(), now).length, 1, "no created_at: the server decides");
  });

  test("stored data that's broken or odd reads as no drafts", () => {
    assert.deepEqual(parseDrafts(null), EMPTY);
    assert.deepEqual(parseDrafts("{not json"), EMPTY);
    assert.deepEqual(parseDrafts(JSON.stringify({ drafts: [{ id: 1 }] })).drafts, []);
    const ok = parseDrafts(JSON.stringify({ drafts: [entry("a", "1")], pending: null }));
    assert.equal(ok.drafts[0].id, "a");
  });

  test("only a plan is kept as a draft, not a single quick add", () => {
    assert.equal(isPlanDraft([{ op: "add_task", title: "Milk", date: "2026-11-14", time: "" }]), false);
    const step = (title: string) => ({ op: "add_task" as const, title, date: "2026-11-14" });
    assert.equal(isPlanDraft([step("Read"), step("Practice")]), true);
    assert.equal(isPlanDraft([{ op: "create_plan", ref: "cp", title: "Competitive programming" }]), true);
    assert.equal(draftTitle({ ops: [{ op: "create_plan", ref: "cp", title: "Competitive programming" }], summary: "x" }), "Competitive programming");
  });

  // Round 6 item 3.
  const planDraft = (id: string, createdAt: string, title: string, origin = "/", target: string | null = null): Entry =>
    ({
      ...entry(id, createdAt),
      title,
      origin,
      changeSet: { id, ops: [{ op: "create_plan", ref: "p", title }], summary: title, target_plan_id: target, created_at: createdAt },
    }) as unknown as Entry;

  test("Confirm clears its pill and the older version of the same plan (Leo, Priya)", () => {
    const older = planDraft("v1", "2026-11-22T10:00:00Z", "Algebra 2 test prep");
    const newer = planDraft("v2", "2026-11-22T10:05:00Z", "Algebra 2 test prep");
    let s = upsertDraft(upsertDraft(EMPTY, older), newer);
    s = settleDrafts(s, { id: "v2", origin: "/", changeSet: newer.changeSet });
    assert.deepEqual(s.drafts, []);
    assert.deepEqual(visibleDrafts(s, new Set(), Date.parse("2026-11-22T11:00:00Z"), "/"), [], "draft → Confirm → no pill");
  });

  test("Confirm leaves a different plan, another page's plan and a newer draft alone", () => {
    const chess = planDraft("c", "2026-11-22T09:00:00Z", "Chess openings");
    const essay = planDraft("e", "2026-11-22T10:00:00Z", "ED II supplemental essay");
    const other = planDraft("o", "2026-11-22T09:30:00Z", "ED II supplemental essay", "/calendar");
    const s = settleDrafts({ drafts: [chess, other, essay], pending: null }, { id: "e", origin: "/", changeSet: essay.changeSet });
    assert.deepEqual(s.drafts.map((d: Entry) => d.id).sort(), ["c", "o"]);
    // A newer version made after the confirmed one stays.
    const v1 = planDraft("v1", "2026-11-22T10:00:00Z", "Robotics club");
    const v2 = planDraft("v2", "2026-11-22T10:05:00Z", "Robotics club");
    const left = settleDrafts({ drafts: [v1, v2], pending: null }, { id: "v1", origin: "/", changeSet: v1.changeSet });
    assert.deepEqual(left.drafts.map((d: Entry) => d.id), ["v2"]);
  });

  test("the same project in two drafts is the same conversation, whatever the name", () => {
    const a = planDraft("a", "2026-11-22T10:00:00Z", "Week 2 of robotics", "/projects/p1", "p1");
    const b = planDraft("b", "2026-11-22T10:05:00Z", "Motor wiring round", "/projects/p1", "p1");
    const s = settleDrafts({ drafts: [a, b], pending: null }, { id: "b", origin: "/projects/p1", changeSet: b.changeSet });
    assert.deepEqual(s.drafts, []);
  });

  test("live Priya case: 'Add to project' draft, then a re-plan that names a new project", () => {
    // Round 6 live check 3: the first draft went into the existing project
    // (summary "Add to project", no create_plan), the re-plan made a new one.
    // The student's own first line is what they share.
    const said = "Help me write my ED II supplemental essay, it needs to be ready before Jan 5. I work at the bakery Wed 4-9pm";
    const first = {
      ...entry("p1", "2026-11-22T22:46:20Z"),
      title: "Add to project",
      changeSet: { id: "p1", ops: [{ op: "add_task" }, { op: "add_task" }], summary: "Add to project", target_plan_id: null, request_text: `${said}

(This request is inside the student's project "ED II Supplemental Essay Draft".)` },
    } as unknown as Entry;
    const replan = {
      ...planDraft("p2", "2026-11-22T22:47:30Z", "ED II Supplemental Essay Draft"),
      changeSet: { ...planDraft("p2", "2026-11-22T22:47:30Z", "ED II Supplemental Essay Draft").changeSet, request_text: `${said}
move the Tuesday step to Thursday` },
    } as unknown as Entry;
    const s = settleDrafts({ drafts: [first, replan], pending: null }, { id: "p2", origin: "/", changeSet: replan.changeSet });
    assert.deepEqual(s.drafts, []);
    // A different goal typed on the same page, also with "help me write…", stays.
    const history = {
      ...entry("h1", "2026-11-22T22:40:00Z"),
      title: "Add to project",
      changeSet: { id: "h1", ops: [], summary: "Add to project", target_plan_id: null, request_text: "help me write my history research paper before winter break" },
    } as unknown as Entry;
    const kept = settleDrafts({ drafts: [history, replan], pending: null }, { id: "p2", origin: "/", changeSet: replan.changeSet });
    assert.deepEqual(kept.drafts.map((d: Entry) => d.id), ["h1"]);
  });

  test("Hide discards nothing; the pill shows again only where it was drafted", () => {
    const d = planDraft("h", "2026-11-22T10:00:00Z", "Club flyer", "/projects/p9");
    const s = hideDraft(upsertDraft(EMPTY, d), "h");
    assert.equal(s.drafts.length, 1, "still kept");
    const now = Date.parse("2026-11-22T11:00:00Z");
    assert.deepEqual(visibleDrafts(s, new Set(), now, "/calendar"), []);
    assert.deepEqual(visibleDrafts(s, new Set(), now, "/projects/p9").map((x: Entry) => x.id), ["h"]);
    // Refreshing the same draft keeps it hidden.
    assert.equal(upsertDraft(s, { ...d, title: "Club flyer v2" }).drafts[0].hidden, true);
  });
});
