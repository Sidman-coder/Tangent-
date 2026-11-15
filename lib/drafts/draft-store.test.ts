import { test } from "node:test";
import assert from "node:assert/strict";

type Mod = typeof import("./draft-store");
type Entry = import("./draft-store").DraftEntry;

void (import("./draft-store.ts" as string) as Promise<Mod>).then(({ EMPTY, upsertDraft, acceptPending, removeDraft, visibleDrafts, parseDrafts, isPlanDraft, draftTitle }) => {
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
});
