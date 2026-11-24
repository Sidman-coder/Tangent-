"use client";

import "@/components/get-to-know-you.css";
import "./you-map.css";

// "What Tangent knows about me" as "You, mapped" (Round 4 §5.4): every fact
// Tangent plans with, as a turning map of the student beside six area cards.
// Each fact says where it came from (You said / Tangent noticed / Guess,
// confirm?) and can be edited, forgotten or confirmed. The cards are the
// accessible list; the map is a picture of them.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, Compass, FolderOpen, Gauge, GraduationCap, Mountain, Plus, Target, X, type LucideIcon } from "lucide-react";
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
import type { MapLevel } from "./YouMap";
import type { FactUsage } from "@/lib/store";
import { factLinks, projectLinks, usageByFact, type PlanRef } from "@/lib/you-map-links";
import { AREA_CATEGORY, NOT_KEPT, localFact, tellReply } from "@/lib/you-map-edit";
import { isSensitive, looksDistressed } from "@/lib/student/sensitive";
import type { FactCategory } from "@/lib/student/facts";
import { UNDO_TOAST_MS } from "@/lib/undo-events";
import type { Noticed } from "@/lib/student/observations";
import KnowsTell from "./KnowsTell";

/** "Tangent noticed" rows share the fact rows' Forget-with-Undo, under this id. */
const NOTICED_ID = "noticed:";

/** Dev previews (/dev/app/settings-context*) hand the page sample facts here
 *  instead of it fetching them; saving is then local only. */
export const SampleKnowsContext = createContext<{ entries: ContextEntry[]; usage: FactUsage[]; plans?: PlanRef[]; summary?: string } | null>(null);

const ICON: Record<MapGroupKey, LucideIcon> = {
  goals: Target,
  classes: GraduationCap,
  commitments: CalendarClock,
  work: Gauge,
  hard: Mountain,
  future: Compass,
};

/** The placeholder in each area's "+ Add" row. */
const ADD_HINT: Record<MapGroupKey, string> = {
  goals: "Something you're working toward",
  classes: "A class, club, team or job",
  commitments: "A fixed part of your week, like “Robotics Tue/Thu until 6”",
  work: "When or how you work best",
  hard: "Something that tends to get in the way",
  future: "Where you'd like to end up",
};

type Sent = { ok: boolean; error?: string; entry?: ContextEntry; entries?: ContextEntry[] };

async function send(body: unknown, keepalive = false): Promise<Sent> {
  try {
    const res = await fetch("/api/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; entry?: ContextEntry; entries?: ContextEntry[] };
    return { ok: res.ok && data.ok === true, error: res.status === 422 ? data.error : undefined, entry: data.entry, entries: data.entries };
  } catch {
    return { ok: false };
  }
}

async function post(body: unknown): Promise<boolean> {
  return (await send(body)).ok;
}

/** A fact's words as an editable field: same font and spot, grows with the
 *  text. Enter saves (Shift+Enter is a new line), Esc cancels. */
function GrowText({ value, onChange, onSave, onCancel, label, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  label: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // border-box: add the border so the last line isn't clipped.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <textarea
      ref={ref}
      className="you-fact-field"
      rows={1}
      value={value}
      maxLength={300}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSave();
        } else if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    />
  );
}

/** ✓ and ✕ beside a field being edited or added. */
function FieldActions({ onSave, onCancel, saving, what }: { onSave: () => void; onCancel: () => void; saving: boolean; what: string }) {
  return (
    <div className="you-fact-meta is-editing">
      <button type="button" className="you-fact-icon is-save" onClick={onSave} disabled={saving} aria-label={`Save ${what}`}>
        <Check size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button type="button" className="you-fact-icon" onClick={onCancel} aria-label="Cancel">
        <X size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <span className="you-fact-keys" aria-hidden="true">Enter to save · Esc to cancel</span>
    </div>
  );
}

export default function WhatTangentKnows() {
  const v2 = usePipelineV2();
  const { state } = useAppState();
  const sample = useContext(SampleKnowsContext);
  const [entries, setEntries] = useState<ContextEntry[] | null>(null);
  const [summary, setSummary] = useState("");
  // Overnight 2, Phase 6: habits from the observation log, in the student's words.
  const [noticed, setNoticed] = useState<Noticed[]>([]);
  const [confirmingForget, setConfirmingForget] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string; error?: string } | null>(null);
  const [adding, setAdding] = useState<{ key: MapGroupKey; text: string; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState<MapGroupKey | null>(null);
  const [level, setLevel] = useState<MapLevel>({ kind: "root" });
  const [usage, setUsage] = useState<FactUsage[]>([]);
  const [glowIds, setGlowIds] = useState<ReadonlySet<string>>(new Set());
  // Forgotten facts wait here (with Undo) before the forget is sent.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const cardRefs = useRef(new Map<MapGroupKey, HTMLElement>());

  const load = useCallback(async () => {
    if (sample) {
      setEntries((cur) => cur ?? sample.entries);
      setSummary(sample.summary ?? "");
      setUsage(sample.usage);
      return;
    }
    // Which plans used which facts: only for the map's satellites and the
    // fact card, so a failure just leaves them empty.
    void fetch("/api/context/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { usage: [] }))
      .then((d: { usage?: FactUsage[] }) => setUsage(d.usage ?? []))
      .catch(() => setUsage([]));
    try {
      const res = await fetch("/api/context", { cache: "no-store" });
      const data = (await res.json()) as { context?: { entries?: ContextEntry[]; compressedSummary?: string }; noticed?: Noticed[] };
      setEntries(data.context?.entries ?? []);
      setSummary(data.context?.compressedSummary ?? "");
      setNoticed(Array.isArray(data.noticed) ? data.noticed : []);
    } catch {
      setEntries([]);
    }
  }, [sample]);

  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(GET_TO_KNOW_DONE_EVENT, reload);
    return () => window.removeEventListener(GET_TO_KNOW_DONE_EVENT, reload);
  }, [load]);

  // The map leaves out facts waiting to be forgotten; the cards keep their row for Undo.
  const kept = useMemo(() => (entries ?? []).filter((e) => !pending.has(e.id)), [entries, pending]);
  const grouped = useMemo(() => groupFacts(entries ?? []), [entries]);
  const mapGrouped = useMemo(() => groupFacts(kept), [kept]);
  const plans = useMemo<PlanRef[]>(() => sample?.plans ?? (state?.plans ?? []).map((p) => ({ id: p.id, title: p.title })), [sample, state?.plans]);
  const projects = useMemo(() => projectFacts(entries ?? [], plans), [entries, plans]);
  const usedBy = useMemo(() => usageByFact(usage, plans), [usage, plans]);
  const links = useMemo(() => [...factLinks(mapGrouped), ...projectLinks(mapGrouped, plans, usedBy)], [mapGrouped, plans, usedBy]);

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

  // New facts glow on the map for a moment.
  const glow = (ids: string[]) => {
    if (!ids.length) return;
    setGlowIds((cur) => new Set([...Array.from(cur), ...ids]));
    setTimeout(() => setGlowIds((cur) => new Set(Array.from(cur).filter((id) => !ids.includes(id)))), 5200);
  };

  // One write for "+ Add", an edit and the Tell pill: the dev sample keeps it
  // local; otherwise POST /api/context. Both go through the sensitive filter.
  const write = async (text: string, opts: { factCategory?: FactCategory; category?: ContextEntry["category"]; projectId?: string | null }): Promise<{ entry?: ContextEntry; error?: string }> => {
    if (sample) {
      const r = localFact(text, opts);
      return r.ok ? { entry: r.entry } : { error: r.error };
    }
    const r = await send({ action: "remember", fact: text, category: opts.category, factCategory: opts.factCategory, projectId: opts.projectId ?? undefined });
    return r.ok && r.entry ? { entry: r.entry } : { error: r.error ?? "Couldn't save that. Try again." };
  };

  const sendForget = (id: string) => {
    if (sample || id.startsWith("local-")) return;
    const body = id.startsWith(NOTICED_ID) ? { action: "forget_noticed", key: id.slice(NOTICED_ID.length) } : { action: "forget", id };
    void send(body, true).then((r) => !r.ok && void load());
  };

  // Forget: the row says "Forgotten" with Undo; the forget is sent once Undo has gone.
  const commitForget = (id: string) => {
    timers.current.delete(id);
    setPending((cur) => new Set(Array.from(cur).filter((x) => x !== id)));
    setEntries((list) => list?.filter((e) => e.id !== id) ?? null);
    setNoticed((list) => list.filter((n) => NOTICED_ID + n.key !== id));
    sendForget(id);
  };
  const forget = (id: string) => {
    setPending((cur) => new Set([...Array.from(cur), id]));
    timers.current.set(id, setTimeout(() => commitForget(id), UNDO_TOAST_MS));
  };
  const undoForget = (id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setPending((cur) => new Set(Array.from(cur).filter((x) => x !== id)));
    glow([id]);
  };
  // Leaving the page (or closing the tab) sends any forget still waiting.
  useEffect(() => {
    const map = timers.current;
    const flush = () => {
      map.forEach((t, id) => {
        clearTimeout(t);
        sendForget(id);
      });
      map.clear();
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // sendForget only reads `sample`, fixed for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async (id: string) => {
    setEntries((list) => list?.map((e) => (e.id === id ? { ...e, unconfirmed: false, factSource: "said" } : e)) ?? null);
    if (sample) return;
    if (!(await post({ action: "confirm", id }))) void load();
  };

  // An edit saves the new wording as something the student said (same area,
  // same project), then drops the old one, so a failed save never loses it.
  const saveEdit = async () => {
    if (!editing || saving) return;
    const text = editing.text.trim();
    const old = entries?.find((e) => e.id === editing.id);
    if (!old || !text || text === old.fact) return setEditing(null);
    setSaving(true);
    const r = await write(text, { factCategory: old.factCategory, category: old.category, projectId: old.projectId });
    setSaving(false);
    if (!r.entry) return setEditing({ ...editing, error: r.error });
    const fresh = { ...r.entry, factCategory: r.entry.factCategory ?? old.factCategory, projectId: r.entry.projectId ?? old.projectId };
    setEntries((list) => list?.map((e) => (e.id === old.id ? fresh : e)) ?? null);
    sendForget(old.id);
    setEditing(null);
    glow([fresh.id]);
  };

  // "+ Add" in an area: the new fact is saved into that area.
  const saveAdd = async () => {
    if (!adding || saving) return;
    const text = adding.text.trim();
    if (!text) return setAdding(null);
    setSaving(true);
    const r = await write(text, AREA_CATEGORY[adding.key]);
    setSaving(false);
    if (!r.entry) return setAdding({ ...adding, error: r.error });
    const entry = { ...r.entry, factCategory: r.entry.factCategory ?? AREA_CATEGORY[adding.key].factCategory };
    setEntries((list) => [...(list ?? []), entry]);
    setAdding(null);
    glow([entry.id]);
  };

  // The Tell pill: Tangent pulls out what's worth keeping and says so.
  const tell = async (text: string): Promise<string> => {
    if (looksDistressed(text)) return tellReply(text, []);
    if (isSensitive(text)) return NOT_KEPT;
    let added: ContextEntry[] = [];
    let error: string | undefined;
    if (!sample) {
      const r = await send({ action: "extract", conversation: `Student: ${text}`, source: "manual" });
      added = r.ok ? r.entries ?? [] : [];
    }
    // Nothing pulled out (or the dev sample): keep the words as one fact.
    if (added.length === 0) {
      const r = await write(text, {});
      if (r.entry) added = [r.entry];
      else error = r.error;
    }
    if (added.length) {
      setEntries((list) => [...(list ?? []), ...added]);
      glow(added.map((e) => e.id));
    }
    return tellReply(text, added, error);
  };

  const forgetAll = async () => {
    setForgetting(true);
    setNote(null);
    const ok = sample ? true : await post({ action: "forget_all", confirm: "FORGET" });
    setForgetting(false);
    setConfirmingForget(false);
    setNote(ok ? { tone: "success", text: "Tangent forgot everything it knew about you." } : { tone: "error", text: "Couldn't forget that. Try again." });
    if (ok) setNoticed([]);
    if (sample) setEntries([]);
    else void load();
  };

  // An area chip under the map: open the area on the map and bring its card up.
  // An area chip opens that area on the map and marks its card below. It no
  // longer scrolls to the card, so the map's area view stays in sight and
  // focus stays on the map (Escape still steps back).
  const pick = (key: MapGroupKey) => {
    setFocus(key);
    setLevel({ kind: "area", key });
  };

  // A drill-in on the map also points the cards below at that area.
  const onLevel = (next: MapLevel) => {
    setLevel(next);
    if (next.kind !== "root") setFocus(next.key);
  };

  // One fact per row, with where it came from and what you can do about it.
  const factRows = (facts: ContextEntry[]) =>
    facts.map((e) => {
      const origin = originOf(e);
      if (pending.has(e.id)) {
        return (
          <li key={e.id} className="you-fact is-forgotten" role="status">
            <p>Forgotten.</p>
            <button type="button" className="you-fact-btn is-strong" onClick={() => undoForget(e.id)} aria-label={`Undo forget: ${e.fact}`}>
              Undo
            </button>
          </li>
        );
      }
      if (editing?.id === e.id) {
        return (
          <li key={e.id} className={`you-fact is-${origin} is-editing`}>
            <GrowText
              value={editing.text}
              onChange={(text) => setEditing({ id: e.id, text })}
              onSave={() => void saveEdit()}
              onCancel={() => setEditing(null)}
              label={`Edit: ${e.fact}`}
            />
            <FieldActions onSave={() => void saveEdit()} onCancel={() => setEditing(null)} saving={saving} what="this fact" />
            {editing.error && <p className="you-fact-error" role="alert">{editing.error}</p>}
          </li>
        );
      }
      return (
        <li key={e.id} className={`you-fact is-${origin}${glowIds.has(e.id) ? " is-new" : ""}`}>
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
            <button type="button" className="you-fact-btn" onClick={() => forget(e.id)} aria-label={`Forget: ${e.fact}`}>
              {origin === "guess" ? "Not right" : "Forget"}
            </button>
          </div>
        </li>
      );
    });

  // The inline "+ Add" row at the bottom of an area's card.
  const addRow = (key: MapGroupKey, label: string) =>
    adding?.key === key && (
      <li className="you-fact is-adding">
        <GrowText
          value={adding.text}
          onChange={(text) => setAdding({ key, text })}
          onSave={() => void saveAdd()}
          onCancel={() => setAdding(null)}
          label={`New fact for ${label}`}
          placeholder={ADD_HINT[key]}
        />
        <FieldActions onSave={() => void saveAdd()} onCancel={() => setAdding(null)} saving={saving} what={`to ${label}`} />
        {adding.error && <p className="you-fact-error" role="alert">{adding.error}</p>}
      </li>
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
          <YouMapHero
            grouped={mapGrouped}
            initials={initials}
            summary={mapSummary(mapGrouped)}
            focus={focus}
            plans={plans}
            links={links}
            usedBy={usedBy}
            level={level}
            onLevel={onLevel}
            onPick={pick}
            glowIds={glowIds}
          />

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
                const shown = facts.filter((f) => !pending.has(f.id)).length;
                const isAdding = adding?.key === group.key;
                return (
                  <section
                    key={group.key}
                    ref={(el) => void (el ? cardRefs.current.set(group.key, el) : cardRefs.current.delete(group.key))}
                    data-group={group.key}
                    tabIndex={-1}
                    className={`you-card${focus === group.key ? " is-focus" : ""}${facts.length || isAdding ? "" : " is-empty"}`}
                    style={{ "--c": `var(--map-${group.color})` } as React.CSSProperties}
                    aria-labelledby={`you-card-${group.key}`}
                  >
                    <header>
                      <span className="you-card-icon" aria-hidden="true">
                        <Icon size={16} strokeWidth={1.75} />
                      </span>
                      <h3 id={`you-card-${group.key}`}>{group.label}</h3>
                      <span className="you-card-count">{shown}</span>
                      <button
                        type="button"
                        className="you-card-add"
                        onClick={() => setAdding({ key: group.key, text: "" })}
                        disabled={isAdding}
                        aria-label={`Add to ${group.label}`}
                      >
                        <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                        Add
                      </button>
                    </header>
                    {facts.length === 0 && !isAdding ? (
                      <p className="you-card-empty">{group.empty} Not asked yet.</p>
                    ) : (
                      <ul>
                        {factRows(facts)}
                        {addRow(group.key, group.label)}
                      </ul>
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
                    <span className="you-card-count">{facts.filter((f) => !pending.has(f.id)).length}</span>
                  </header>
                  <ul>{factRows(facts)}</ul>
                </section>
              ))}

              {/* Overnight 2, Phase 6: the habits Tangent plans with, from what
                  the student does with steps (never their titles or notes). */}
              {noticed.length > 0 && (
                <section className="you-card is-habits" style={{ "--c": "var(--map-work)" } as React.CSSProperties} aria-labelledby="you-card-noticed">
                  <header>
                    <span className="you-card-icon" aria-hidden="true">
                      <Gauge size={16} strokeWidth={1.75} />
                    </span>
                    <h3 id="you-card-noticed">Tangent noticed</h3>
                  </header>
                  <p className="you-card-note">From what you do with your steps, never what they say.</p>
                  <ul>
                    {noticed.map((n) => {
                      const id = NOTICED_ID + n.key;
                      if (pending.has(id)) {
                        return (
                          <li key={id} className="you-fact is-forgotten" role="status">
                            <p>Forgotten.</p>
                            <button type="button" className="you-fact-btn is-strong" onClick={() => undoForget(id)} aria-label={`Undo forget: ${n.title}`}>
                              Undo
                            </button>
                          </li>
                        );
                      }
                      return (
                        <li key={id} className="you-fact is-habit">
                          <p className="you-noticed-title">{n.title}</p>
                          {n.lines.map((line) => (
                            <p key={line}>{line}</p>
                          ))}
                          <div className="you-fact-meta">
                            <button type="button" className="you-fact-btn" onClick={() => forget(id)} aria-label={`Forget: ${n.title}`}>
                              Forget
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>

            <KnowsTell onTell={tell} />

            {(entries.length > 0 || summary || noticed.length > 0) && (
              <div className="settings-card knows-card knows-danger">
                <div className={`settings-row${confirmingForget ? " is-stacked" : ""}`}>
                  <div className="settings-row-copy">
                    <strong>Forget everything</strong>
                    <span>Clears every fact here and the habits Tangent noticed. Your tasks, projects and chats stay.</span>
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
                      <p>Tangent deletes these facts and its record of how you work and plan (your pace, best hours and days). It plans without them until it learns them again. This can&apos;t be undone.</p>
                    </ConfirmPanel>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => setConfirmingForget(true)}>Forget everything</Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {note && <div className="settings-section-footer"><FormMessage tone={note.tone}>{note.text}</FormMessage></div>}
    </section>
  );
}
