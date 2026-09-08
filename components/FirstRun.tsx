"use client";

import { useState } from "react";

export default function FirstRun({ onComplete }: { onComplete: () => Promise<void> | void }) {
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: trimmed }] }),
      });
      await onComplete();
    } catch {
      setSubmitting(false);
    }
  };

  const skip = async () => {
    if (submitting) return;
    await onComplete();
  };

  return (
    <div className="firstrun-overlay">
      <div className="firstrun-panel">
        <span className="t-label firstrun-eyebrow">Welcome to TANGENT</span>
        <h1 className="t-display firstrun-title">What&apos;s on your mind?</h1>
        <input
          type="text"
          className="firstrun-input"
          placeholder="e.g. Plan my week around a big presentation Friday"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          disabled={submitting}
          autoFocus
        />
        <button type="button" className="firstrun-submit" onClick={() => void submit()} disabled={submitting || !input.trim()}>
          {submitting ? "Building your plan…" : "Get started"}
        </button>
        <button type="button" className="firstrun-skip" onClick={() => void skip()} disabled={submitting}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
