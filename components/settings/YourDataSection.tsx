"use client";

// Settings → Your data: what Tangent keeps and why, who processes it, and a
// copy of all of it to download (/api/export), and deleting it (/api/reset).
// Every line here matches what the store and the API routes actually do.

import { useState } from "react";
import Button from "@/components/ui/Button";
import ConfirmPanel from "@/components/ui/ConfirmPanel";
import FormMessage from "@/components/ui/FormMessage";
import { clearLocalAppData } from "@/lib/auth/clear-local";

const STORES: { what: string; why: string }[] = [
  { what: "Your tasks, projects, Paths and chats", why: "That's your planner." },
  { what: "What Tangent knows about you", why: "The facts on What Tangent knows, so it doesn't ask twice. Forget any of them any time." },
  { what: "The words of your last 100 voice commands", why: "So it can act on them and you can undo. Your audio itself isn't kept." },
  { what: "Your Canvas calendar link", why: "To sync assignments. It's only ever shown masked." },
  { what: "How much AI each request used", why: "Word counts, not what you wrote, to keep Tangent fast and affordable." },
];

const PROCESSORS = [
  { name: "Anthropic (Claude)", role: "writes plans, questions and answers" },
  { name: "Deepgram", role: "turns what you say into text" },
  { name: "Supabase", role: "stores your data" },
  { name: "Vercel", role: "runs the app" },
];

type Msg = { tone: "success" | "error"; text: string } | null;

export default function YourDataSection() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<Msg>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteAll = async () => {
    setDeleting(true);
    setNote(null);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET" }),
      });
      if (!res.ok) throw new Error("reset failed");
      clearLocalAppData();
      window.location.assign("/");
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
      setNote({ tone: "error", text: "Couldn't delete your data. Nothing was removed. Try again." });
    }
  };

  const clearCache = () => {
    clearLocalAppData();
    setNote({ tone: "success", text: "Cleared what this browser had saved. Your account data is untouched." });
  };

  return (
    <section id="your-data" className="settings-group" aria-labelledby="your-data-title">
      <h2 id="your-data-title" className="settings-group-title">What&apos;s stored</h2>
      <p className="settings-group-note">What Tangent keeps, why, and who helps it run. It&apos;s yours: take a copy any time.</p>
      <div className="settings-card">
        <div className="settings-row is-stacked">
          <div className="settings-row-main">
            <div className="settings-row-copy">
              <strong>What Tangent stores</strong>
              <span>Only what it needs to plan for you.</span>
            </div>
            <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Hide" : "Show"}</Button>
          </div>
          {open && (
            <div className="data-detail">
              <ul>
                {STORES.map((s) => (
                  <li key={s.what}>
                    <strong>{s.what}</strong>
                    <span>{s.why}</span>
                  </li>
                ))}
              </ul>
              <p className="data-processors">
                Helping it run:{" "}
                {PROCESSORS.map((p, i) => (
                  <span key={p.name}>
                    <strong>{p.name}</strong> {p.role}
                    {i < PROCESSORS.length - 1 ? "; " : "."}
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Download my data</strong>
            <span>Everything Tangent stores for you, as one file. Your Canvas link is left out.</span>
          </div>
          <a href="/api/export" download className="ui-button ui-button--secondary ui-button--sm">Download</a>
        </div>
        <div className="settings-row">
          <div className="settings-row-copy">
            <strong>Clear this browser</strong>
            <span>Forgets saved chat ids, cached titles and nudges on this device. Nothing in your account changes.</span>
          </div>
          <Button size="sm" onClick={clearCache}>Clear</Button>
        </div>
        <div className={`settings-row${confirmingDelete ? " is-stacked" : ""}`}>
          <div className="settings-row-copy">
            <strong>Delete all my data</strong>
            <span>Removes your tasks, projects, chats and history. Your account stays.</span>
          </div>
          {confirmingDelete ? (
            <ConfirmPanel
              title="Delete all your Tangent data?"
              word="DELETE"
              actionLabel="Delete everything"
              busyLabel="Deleting…"
              busy={deleting}
              onCancel={() => setConfirmingDelete(false)}
              onConfirm={() => void deleteAll()}
            >
              <p>
                This permanently removes your tasks, projects, chats, notifications, AI history, what Tangent knows and your Canvas
                connection, and restarts setup. You stay signed in. Download a copy first if you want one. This can&apos;t be undone.
              </p>
            </ConfirmPanel>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmingDelete(true)}>Delete data</Button>
          )}
        </div>
      </div>
      {note && <div className="settings-section-footer"><FormMessage tone={note.tone}>{note.text}</FormMessage></div>}
    </section>
  );
}
