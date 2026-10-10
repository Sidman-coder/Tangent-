"use client";

import "@/components/get-to-know-you.css";

// "What Tangent knows about me": every fact Tangent has learned from chats,
// captures and answers to its questions — the context every AI step reads.
// The student can see it, forget anything wrong, and add things themselves.

import { useCallback, useEffect, useState } from "react";
import type { ContextEntry } from "@/lib/types";
import { GET_TO_KNOW_DONE_EVENT, GET_TO_KNOW_EVENT } from "@/components/GetToKnowYou";

const CATEGORY_LABEL: Record<ContextEntry["category"], string> = {
  goal: "Goals",
  commitment: "Commitments",
  habit: "How you work",
  preference: "Preferences",
  work: "Classes & work",
  person: "People",
  general: "Other",
};
const ORDER: ContextEntry["category"][] = ["goal", "commitment", "work", "habit", "preference", "person", "general"];

async function post(body: unknown): Promise<boolean> {
  const res = await fetch("/api/context", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return res.ok && data.ok === true;
}

export default function WhatTangentKnows() {
  const [entries, setEntries] = useState<ContextEntry[] | null>(null);
  const [summary, setSummary] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

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

  const forget = async (id: string) => {
    setEntries((list) => list?.filter((e) => e.id !== id) ?? null);
    if (!(await post({ action: "forget", id }))) void load();
  };

  const remember = async () => {
    const fact = draft.trim();
    if (!fact) return;
    setBusy(true);
    if (await post({ action: "remember", fact })) setDraft("");
    setBusy(false);
    void load();
  };

  const groups = ORDER.map((c) => ({ c, items: (entries ?? []).filter((e) => e.category === c) })).filter((g) => g.items.length > 0);

  return (
    <section id="what-tangent-knows" className="settings-panel">
      <div className="settings-panel-head">
        <div>
          <h2>What Tangent knows</h2>
          <p>Everything Tangent has learned about you. It uses this for every plan and answer. Remove anything that&apos;s wrong.</p>
        </div>
        <button type="button" className="knows-gtk" onClick={() => window.dispatchEvent(new Event(GET_TO_KNOW_EVENT))}>
          Answer a few questions
        </button>
      </div>

      {entries === null ? (
        <span className="settings-skeleton" aria-label="Loading" />
      ) : groups.length === 0 && !summary ? (
        <p className="knows-empty">Nothing yet. Answer Tangent&apos;s questions or add something below.</p>
      ) : (
        <div className="knows-groups">
          {summary && (
            <div className="knows-group">
              <h3>Earlier</h3>
              <p className="knows-summary">{summary}</p>
            </div>
          )}
          {groups.map(({ c, items }) => (
            <div key={c} className="knows-group">
              <h3>{CATEGORY_LABEL[c]}</h3>
              <ul>
                {items.map((e) => (
                  <li key={e.id}>
                    <span>{e.fact}</span>
                    <button type="button" className="knows-forget" onClick={() => void forget(e.id)} aria-label={`Forget: ${e.fact}`}>
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <form
        className="knows-add"
        onSubmit={(e) => {
          e.preventDefault();
          void remember();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tell Tangent something about you — “I have robotics Tue/Thu until 6”"
          aria-label="Something Tangent should know"
          maxLength={300}
        />
        <button type="submit" className="knows-add-btn" disabled={busy || !draft.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
