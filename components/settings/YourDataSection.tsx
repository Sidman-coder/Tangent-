"use client";

// Settings → Your data: what Tangent keeps and why, who processes it, and a
// copy of all of it to download. Every line here matches what the store and
// the API routes actually do (lib/store.ts, app/api/voice-browser).

import { useState } from "react";
import Button from "@/components/ui/Button";

const STORES: { what: string; why: string }[] = [
  { what: "Your tasks, projects, Tangents and chats", why: "That's your planner." },
  { what: "What Tangent knows about you", why: "The facts listed above, so it doesn't ask twice. Forget any of them any time." },
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

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export default function YourDataSection() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const download = async () => {
    setBusy(true);
    setNote(null);
    const [state, context, sessions, paths] = await Promise.all([
      getJson("/api/state"),
      getJson("/api/context"),
      getJson("/api/sessions"),
      getJson("/api/path"),
    ]);
    const data = { exportedAt: new Date().toISOString(), state, context, chats: sessions, tangents: paths };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tangent-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setBusy(false);
    setNote(state ? "Downloaded." : "Some of it couldn't be fetched. Try again.");
  };

  return (
    <section id="your-data" className="settings-group" aria-labelledby="your-data-title">
      <h2 id="your-data-title" className="settings-group-title">Your data</h2>
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
            <span>Everything above, as one file.</span>
          </div>
          <Button size="sm" loading={busy} loadingLabel="Preparing…" onClick={() => void download()}>Download</Button>
        </div>
      </div>
      {note && <p className="settings-status" role="status">{note}</p>}
    </section>
  );
}
