"use client";

// Fresh start: moves what's behind to the days ahead, without penalty. It says
// what it will do before it does it, and the result can be undone.

import { useState } from "react";
import { RotateCcw } from "lucide-react";

export default function FreshStart({
  count,
  backlog,
  onConfirm,
}: {
  count: number;
  backlog: boolean;
  onConfirm: () => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const confirm = async () => {
    setSaving(true);
    const ok = await onConfirm();
    setSaving(false);
    if (ok) setOpen(false);
  };

  return (
    <div className="today-fresh">
      {!open && (
        <div className="today-fresh-row">
          {backlog && <p>A lot piled up. A fresh start could clear it.</p>}
          <button type="button" className="today-fresh-link" onClick={() => setOpen(true)}>
            <RotateCcw size={14} aria-hidden="true" /> Fresh start
          </button>
        </div>
      )}
      {open && (
        <div className="today-step-split" role="status">
          <p>
            {count === 0
              ? "Nothing to clear. You're up to date."
              : `Moves ${count} step${count === 1 ? "" : "s"} that ${count === 1 ? "is" : "are"} behind to the days ahead. Nothing is deleted, and real due dates like Canvas stay put.`}
          </p>
          <div className="today-step-actions">
            {count > 0 && (
              <button type="button" className="today-step-btn is-primary" onClick={() => void confirm()} disabled={saving}>
                Start fresh
              </button>
            )}
            <button type="button" className="today-step-btn" onClick={() => setOpen(false)} disabled={saving}>
              {count === 0 ? "OK" : "Keep as is"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
