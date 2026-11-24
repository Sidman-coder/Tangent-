"use client";

// Settings → Schedule: "When are you already busy?" (Round 4 Phase 6). The
// same editor as the onboarding question; saving replaces the busy blocks on
// the calendar.

import { useEffect, useState } from "react";
import CommitmentsList, { commitmentsReady } from "@/components/schedule/CommitmentsList";
import Button from "@/components/ui/Button";
import FormMessage from "@/components/ui/FormMessage";
import { MAX_COMMITMENTS, summarizeCommitment, type Commitment } from "@/lib/commitments";

type Msg = { tone: "success" | "error"; text: string } | null;

export default function CommitmentsEditor({ onSaved }: { onSaved: () => Promise<void> }) {
  const [saved, setSaved] = useState<Commitment[] | null>(null);
  const [draft, setDraft] = useState<Commitment[]>([]);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/commitments", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; commitments?: Commitment[] }) => {
        if (live) setSaved(d.ok && Array.isArray(d.commitments) ? d.commitments : []);
      })
      .catch(() => {
        if (live) {
          setSaved([]);
          setMsg({ tone: "error", text: "Couldn't load what you're busy with." });
        }
      });
    return () => {
      live = false;
    };
  }, []);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/commitments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitments: draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; commitments?: Commitment[] };
      if (!res.ok || !data.ok) {
        setMsg({ tone: "error", text: data.error ?? "Couldn't save. Try again." });
        return;
      }
      setSaved(data.commitments ?? draft);
      await onSaved();
      setEditing(false);
      setMsg({ tone: "success", text: "Saved. Your calendar shows these as busy." });
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach Tangent. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const list = saved ?? [];
  const ready = commitmentsReady(draft) && draft.length <= MAX_COMMITMENTS;

  return (
    <div className={`settings-row${editing ? " is-stacked" : ""}`}>
      <div className="settings-row-copy">
        <strong>When you&apos;re already busy</strong>
        {saved === null ? (
          <span>Loading…</span>
        ) : list.length === 0 ? (
          <span>Nothing yet. Add school, practice, work or anything else, and Tangent won&apos;t plan inside it.</span>
        ) : (
          !editing && (
            <ul className="settings-commitments">
              {list.map((c, i) => (
                <li key={c.id ?? i}>{summarizeCommitment(c)}</li>
              ))}
            </ul>
          )
        )}
        {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
      </div>
      {!editing ? (
        <Button
          size="sm"
          disabled={saved === null}
          onClick={() => {
            setMsg(null);
            setDraft(list.map((c) => ({ ...c, blocks: c.blocks.map((b) => ({ ...b, days: [...b.days] })) })));
            setEditing(true);
          }}
        >
          {list.length ? "Edit" : "Add"}
        </Button>
      ) : (
        <form
          className="settings-edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) void save();
          }}
        >
          <CommitmentsList idPrefix="settings-cmt" value={draft} onChange={setDraft} />
          <div className="settings-edit-actions">
            <Button type="submit" size="sm" variant="primary" disabled={!ready} loading={busy} loadingLabel="Saving…">
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
