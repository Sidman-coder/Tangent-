"use client";

import "@/components/get-to-know-you.css";

// "What Tangent knows about me": every fact Tangent has learned from chats,
// captures and answers to its questions — the context every AI step reads.
// The student can see it, forget anything wrong, and add things themselves.

import { useCallback, useEffect, useState } from "react";
import type { ContextEntry } from "@/lib/types";
import type { FactCategory } from "@/lib/student/facts";
import { GET_TO_KNOW_DONE_EVENT } from "@/components/GetToKnowYou";
import { usePipelineV2 } from "@/components/PipelineFlag";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FormMessage from "@/components/ui/FormMessage";

// The student-model categories (lib/student/facts.ts FACT_CATEGORY_LABELS),
// copied as plain strings so the fact rules stay out of the client bundle.
const CATEGORY_LABEL: Record<FactCategory, string> = {
  goals: "Goals",
  schedule: "Your schedule",
  classes_activities: "Classes and activities",
  how_you_work: "How you work",
  whats_hard: "What's hard",
  push_style: "How you like to be pushed",
  future: "Your future",
  identity: "About you",
};
const ORDER: FactCategory[] = ["goals", "schedule", "classes_activities", "how_you_work", "whats_hard", "push_style", "future", "identity"];

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
  const [entries, setEntries] = useState<ContextEntry[] | null>(null);
  const [summary, setSummary] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingForget, setConfirmingForget] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [note, setNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);

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

  const confirm = async (id: string) => {
    setEntries((list) => list?.map((e) => (e.id === id ? { ...e, unconfirmed: false } : e)) ?? null);
    if (!(await post({ action: "confirm", id }))) void load();
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

  const groups = ORDER.map((c) => ({ c, items: (entries ?? []).filter((e) => (e.factCategory ?? "identity") === c) })).filter((g) => g.items.length > 0);

  return (
    <section id="what-tangent-knows" className="settings-group" aria-labelledby="knows-title">
      <h2 id="knows-title" className="settings-group-title">Facts it plans with</h2>
      <p className="settings-group-note">
        Everything Tangent has learned about you. It uses this for every plan, question and answer. Forget anything that&apos;s wrong.
        {v2 && (
          <>
            {" "}
            To see what Tangent did, open <Link href="/settings/activity">AI activity</Link>.
          </>
        )}
      </p>
      <div className="settings-card knows-card">
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
                    <span>
                      {e.unconfirmed && <em className="knows-guess">Guess · </em>}
                      {e.fact}
                    </span>
                    {e.unconfirmed && (
                      <button type="button" className="knows-forget" onClick={() => void confirm(e.id)} aria-label={`That's right: ${e.fact}`}>
                        That&apos;s right
                      </button>
                    )}
                    <button type="button" className="knows-forget" onClick={() => void forget(e.id)} aria-label={`Forget: ${e.fact}`}>
                      {e.unconfirmed ? "Not right" : "Forget"}
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
          name="fact"
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
      {(entries?.length ?? 0) > 0 || summary ? (
        <div className={`settings-row${confirmingForget ? " is-stacked" : ""}`}>
          <div className="settings-row-copy">
            <strong>Forget everything</strong>
            <span>Clears every fact above. Your tasks, projects and chats stay.</span>
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
      ) : null}
      </div>
      {note && <div className="settings-section-footer"><FormMessage tone={note.tone}>{note.text}</FormMessage></div>}
    </section>
  );
}
