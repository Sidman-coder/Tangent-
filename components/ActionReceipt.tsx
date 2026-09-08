"use client";

import { useState } from "react";

export default function ActionReceipt({
  actionId,
  label,
  onUndone,
  initiallyUndone,
  undoable = true,
}: {
  actionId: string;
  label: string;
  onUndone?: () => void;
  initiallyUndone?: boolean;
  undoable?: boolean;
}) {
  const [state, setState] = useState<"idle" | "undoing" | "undone" | "error">(initiallyUndone ? "undone" : "idle");
  const [error, setError] = useState<string | null>(null);

  const undo = async () => {
    if (state !== "idle") return;
    setState("undoing");
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: actionId }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !data.ok) throw new Error(data.message || "Could not undo");
      setState("undone");
      onUndone?.();
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Could not undo");
    }
  };

  return (
    <div className="action-receipt">
      <span className="action-receipt-label">{label}</span>
      {state === "undone" ? (
        <span className="action-receipt-status">Undone</span>
      ) : state === "error" ? (
        <span className="action-receipt-status is-error">{error}</span>
      ) : undoable ? (
        <button
          type="button"
          className="action-receipt-undo"
          onClick={undo}
          disabled={state === "undoing"}
        >
          {state === "undoing" ? "Undoing…" : "Undo"}
        </button>
      ) : null}
    </div>
  );
}
