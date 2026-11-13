"use client";

import "@/components/get-to-know-you.css";
import "./you-map.css";

// "What Tangent knows about me" as "You, mapped" (Round 4 §5.4): every fact
// Tangent plans with, as a turning map of the student beside six area cards.
// Each fact says where it came from (You said / Tangent noticed / Guess,
// confirm?) and can be edited, forgotten or confirmed. The cards are the
// accessible list; the map is a picture of them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Compass, FolderOpen, Gauge, GraduationCap, Mountain, Target, type LucideIcon } from "lucide-react";
import type { ContextEntry } from "@/lib/types";
import { groupFacts, initialsOf, mapSummary, ORIGIN_LABEL, originOf, projectFacts, type MapGroupKey } from "@/lib/you-map";
import { GET_TO_KNOW_DONE_EVENT } from "@/components/GetToKnowYou";
import { useAppState } from "@/components/AppStateProvider";
import { usePipelineV2 } from "@/components/PipelineFlag";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FormMessage from "@/components/ui/FormMessage";
import YouMapHero from "./YouMapHero";

const ICON: Record<MapGroupKey, LucideIcon> = {
  goals: Target,
  classes: GraduationCap,
  commitments: CalendarClock,
  work: Gauge,
  hard: Mountain,
  future: Compass,
};

async function send(body: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && data.ok === true, error: res.status === 422 ? data.error : undefined };
  } catch {
    return { ok: false };
  }
}

async function post(body: unknown): Promise<boolean> {
  return (await send(body)).ok;
}

export default function WhatTangentKnows() {
  const v2 = usePipelineV2();
  const { state } = useAppState();
  const [entries, setEntries] = useState<ContextEntry[] | null>(null);
  const [summary, setSummary] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingForget, setConfirmingForget] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [focus, setFocus] = useState<MapGroupKey | null>(null);
  const cardRefs = useRef(new Map<MapGroupKey, HTMLElement>());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/context", { cache: "no-store" });
      const data = (await res.json()) as { context?: { entries?: ContextEntry[]; compressedSummary?: string } };
      setEntries(data.context?.entries ?? []);
      setSummary(data.context?.compressedSummary ?? "");
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(GET_TO_KNOW_DONE_EVENT, reload);
    return () => window.removeEventListener(GET_TO_KNOW_DONE_EVENT, reload);
  }, [load]);

  const grouped = useMemo(() => groupFacts(entries ?? []), [entries]);
  const projects = useMemo(() => projectFacts(entries ?? [], (state?.plans ?? []).map((p) => ({ id: p.id, title: p.title }))), [entries, state?.plans]);

  // Scroll-driven: the card nearest the middle of the screen turns the map.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (seen) => {
        const hit = seen.filter((s) => s.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const key = hit?.target.getAttribute("data-group") as MapGroupKey | null;
        if (key) setFocus(key);
      },
      { rootMargin: "-35% 0px -45% 0px", threshold: [0, 0.5, 1] }
    );
    cardRefs.current.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [entries]);

  const forget = async (id: string) => {
    setEntries((list) => list?.filter((e) => e.id !== id) ?? null);
    if (!(await post({ action: "forget", id }))) void load();
  };

  const confirm = async (id: string) => {
    setEntries((list) => list?.map((e) => (e.id === id ? { ...e, unconfirmed: false, factSource: "said" } : e)) ?? null);
    if (!(await post({ action: "confirm", id }))) void load();
  };

  // An edit saves the new wording as something the student said, then drops
  // the old one, so a failed save never loses the original.
  const saveEdit = async () => {
    if (!editing) return;
    const text = editing.text.trim();
    const old = entries?.find((e) => e.id === editing.id);
    if (!old || !text || text === old.fact) return setEditing(null);
    setNote(null);
    const result = await send({ action: "remember", fact: text });
    if (!result.ok) return setNote({ tone: "error", text: result.error ?? "Couldn't save that. Try again." });
    await post({ action: "forget", id: old.id });
    setEditing(null);
    void load();
  };

  const forgetAll = async () => {
    setForgetting(true);
    setNote(null);
    const ok = await post({ action: "forget_all", confirm: "FORGET" });
    setForgetting(false);
    setConfirmingForget(false);
    setNote(ok ? { tone: "success", text: "Tangent forgot everything it knew about you." } : { tone: "error", text: "Couldn't forget that. Try again." });
    void load();
  };

  const remember = async () => {
    const fact = draft.trim();
    if (!fact) return;
    setBusy(true);
    setNote(null);
    const result = await send({ action: "remember", fact });
    if (result.ok) setDraft("");
    else setNote({ tone: "error", text: result.error ?? "Couldn't save that. Try again." });
    setBusy(false);
    void load();
  };

  const pick = (key: MapGroupKey) => {
    setFocus(key);
    const el = cardRefs.current.get(key);
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };

  // One fact per row, with where it came from and what you can do about it.
  const factList = (facts: ContextEntry[]) => (
    <ul>
      {facts.map((e) => {
        const origin = originOf(e);
        const isEditing = editing?.id === e.id;
        return (
          <li key={e.id} className={`you-fact is-${origin}`}>
            {isEditing ? (
              <form
                className="you-fact-edit"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  void saveEdit();
                }}
              >
                <input
                  value={editing.text}
                  onChange={(ev) => setEditing({ id: e.id, text: ev.target.value })}
                  onKeyDown={(ev) => ev.key === "Escape" && setEditing(null)}
                  aria-label={`Edit: ${e.fact}`}
                  maxLength={300}
                  autoFocus
                />
                <button type="submit" className="you-fact-btn is-strong">Save</button>
                <button type="button" className="you-fact-btn" onClick={() => setEditing(null)}>Cancel</button>
              </form>
            ) : (
              <>
                <p>{e.fact}</p>
                <div className="you-fact-meta">
                  <span className="you-fact-origin">{ORIGIN_LABEL[origin]}</span>
                  {origin === "guess" && (
                    <button type="button" className="you-fact-btn is-strong" onClick={() => void confirm(e.id)} aria-label={`That's right: ${e.fact}`}>
                      Confirm
                    </button>
                  )}
                  <button type="button" className="you-fact-btn" onClick={() => setEditing({ id: e.id, text: e.fact })} aria-label={`Edit: ${e.fact}`}>
                    Edit
                  </button>
                  <button type="button" className="you-fact-btn" onClick={() => void forget(e.id)} aria-label={`Forget: ${e.fact}`}>
                    {origin === "guess" ? "Not right" : "Forget"}
                  </button>
                </div>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );

  const initials = initialsOf(state?.user.displayName ?? "");

  return (
    <section id="what-tangent-knows" className="settings-group you-map" aria-labelledby="knows-title">
      {entries === null ? (
        <>
          <h2 id="knows-title" className="settings-group-title">You, mapped</h2>
          <div className="settings-card knows-card">
            <span className="settings-skeleton" aria-label="Loading" />
          </div>
        </>
      ) : (
        <>
          {/* Round 4 Phase 4: the map fills the window, then the facts follow. */}
          <YouMapHero grouped={grouped} initials={initials} summary={mapSummary(grouped)} focus={focus} onPick={pick} />

          <div className="you-map-head">
            <p className="settings-group-note">
              Tangent uses all of this for every plan, question and answer. Fix or forget anything that&apos;s wrong.
              {v2 && (
                <>
                  {" "}
                  To see what Tangent did with it, open <Link href="/settings/activity">AI activity</Link>.
                </>
              )}
            </p>
          </div>

          <div className="you-map-body is-below">
            <div className="you-map-cards">
              {summary && (
                <div className="you-card is-earlier">
                  <h3>Earlier</h3>
                  <p className="knows-summary">{summary}</p>
                </div>
              )}
              {grouped.map(({ group, facts }) => {
                const Icon = ICON[group.key];
                return (
                  <section
                    key={group.key}
                    ref={(el) => void (el ? cardRefs.current.set(group.key, el) : cardRefs.current.delete(group.key))}
                    data-group={group.key}
                    tabIndex={-1}
                    className={`you-card${focus === group.key ? " is-focus" : ""}${facts.length ? "" : " is-empty"}`}
                    style={{ "--c": `var(--series-${group.color})` } as React.CSSProperties}
                    aria-labelledby={`you-card-${group.key}`}
                  >
                    <header>
                      <span className="you-card-icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <h3 id={`you-card-${group.key}`}>{group.label}</h3>
                      <span className="you-card-count">{facts.length}</span>
                    </header>
                    {facts.length === 0 ? (
                      <p className="you-card-empty">{group.empty} Nothing yet.</p>
                    ) : (
                      factList(facts)
                    )}
                  </section>
                );
              })}

              {projects.map(({ projectId, title, facts }) => (
                <section key={projectId} className="you-card is-project" aria-labelledby={`you-card-project-${projectId}`}>
                  <header>
                    <span className="you-card-icon" aria-hidden="true">
                      <FolderOpen size={16} strokeWidth={1.75} />
                    </span>
                    <h3 id={`you-card-project-${projectId}`}>{title}</h3>
                    <span className="you-card-count">{facts.length}</span>
                  </header>
                  {factList(facts)}
                </section>
              ))}

              <div className="settings-card knows-card">
                <form
                  className="knows-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void remember();
                  }}
                >
                  <input
                    name="fact"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a fact: “I have robotics Tue/Thu until 6”"
                    aria-label="Add a fact Tangent should know"
                    maxLength={300}
                  />
                  <button type="submit" className="knows-add-btn" disabled={busy || !draft.trim()}>
                    Add
                  </button>
                </form>
                {(entries.length > 0 || summary) && (
                  <div className={`settings-row${confirmingForget ? " is-stacked" : ""}`}>
                    <div className="settings-row-copy">
                      <strong>Forget everything</strong>
                      <span>Clears every fact here. Your tasks, projects and chats stay.</span>
                    </div>
                    {confirmingForget ? (
                      <ConfirmPanel
                        title="Forget everything Tangent knows?"
                        word="FORGET"
                        actionLabel="Forget everything"
                        busyLabel="Forgetting…"
                        busy={forgetting}
                        onCancel={() => setConfirmingForget(false)}
                        onConfirm={() => void forgetAll()}
                      >
                        <p>Tangent will plan without any of these facts until it learns them again. This can&apos;t be undone.</p>
                      </ConfirmPanel>
                    ) : (
                      <Button size="sm" variant="danger" onClick={() => setConfirmingForget(true)}>Forget everything</Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
      {note && <div className="settings-section-footer"><FormMessage tone={note.tone}>{note.text}</FormMessage></div>}
    </section>
  );
}
