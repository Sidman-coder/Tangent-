"use client";

// "Bring context from another AI": paste what Claude, ChatGPT or another
// assistant knows about you (or drop in a .txt / .md / .json export). Tangent
// pulls out the facts that matter for planning and shows them; you keep the
// ones that are right, and only those are saved.

import { useState } from "react";
import type { ContextEntry } from "@/lib/types";

const ASK_PROMPT =
  "Tell me everything you know about me that would help a planner organize my schoolwork, activities and goals: my school, classes, activities and when they happen, goals, deadlines, and how I like to work. Use short bullet points.";

type Fact = { category: ContextEntry["category"]; fact: string };

export default function ImportContext({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [keep, setKeep] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const readFile = async (file: File) => {
    if (file.size > 2_000_000) {
      setError("That file is too big. Paste the part about you instead.");
      return;
    }
    const raw = await file.text();
    setText((t) => (t ? `${t}\n\n${raw}` : raw).slice(0, 80000));
  };

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_preview", text }),
      });
      const data = (await res.json()) as { ok?: boolean; facts?: Fact[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Couldn't read that.");
      setFacts(data.facts ?? []);
      setKeep(new Set((data.facts ?? []).map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!facts) return;
    setBusy(true);
    try {
      await fetch("/api/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remember_many", facts: facts.filter((_, i) => keep.has(i)) }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-ctx">
      {facts === null ? (
        <>
          <p className="import-ctx-step">
            <strong>1.</strong> Ask your other AI this, then copy its answer:
          </p>
          <div className="import-ctx-prompt">
            <span>{ASK_PROMPT}</span>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(ASK_PROMPT).then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                });
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="import-ctx-step">
            <strong>2.</strong> Paste it here, or add an exported file.
          </p>
          <textarea
            className="import-ctx-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste what Claude or ChatGPT knows about you…"
            rows={7}
            aria-label="Context from another AI"
          />
          <div className="import-ctx-actions">
            <label className="import-ctx-file">
              Add a file (.txt, .md, .json)
              <input
                type="file"
                accept=".txt,.md,.markdown,.json,text/plain,application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="import-ctx-spacer" />
            <button type="button" className="knows-gtk" onClick={() => void preview()} disabled={busy || text.trim().length < 20}>
              {busy ? "Reading…" : "Find what matters"}
            </button>
          </div>
        </>
      ) : facts.length === 0 ? (
        <p className="import-ctx-step">Nothing in there helps with planning. Try pasting a different part.</p>
      ) : (
        <>
          <p className="import-ctx-step">
            Tangent found {facts.length} thing{facts.length === 1 ? "" : "s"}. Uncheck anything that&apos;s wrong.
          </p>
          <ul className="import-ctx-facts">
            {facts.map((f, i) => (
              <li key={i}>
                <label>
                  <input
                    type="checkbox"
                    checked={keep.has(i)}
                    onChange={() =>
                      setKeep((k) => {
                        const n = new Set(k);
                        if (n.has(i)) n.delete(i);
                        else n.add(i);
                        return n;
                      })
                    }
                  />
                  <span>{f.fact}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="import-ctx-actions">
            <button type="button" className="knows-secondary" onClick={() => setFacts(null)} disabled={busy}>
              Back
            </button>
            <span className="import-ctx-spacer" />
            <button type="button" className="knows-gtk" onClick={() => void save()} disabled={busy || keep.size === 0}>
              {busy ? "Saving…" : `Save ${keep.size}`}
            </button>
          </div>
        </>
      )}
      {error && <p className="import-ctx-error" role="alert">{error}</p>}
    </div>
  );
}
