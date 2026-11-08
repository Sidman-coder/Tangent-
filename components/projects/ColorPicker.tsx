"use client";

// A project's color, from the palette only. Saves on pick, with Undo.

import { useState } from "react";
import ActionReceipt from "@/components/ActionReceipt";
import { SERIES_KEYS, projectSeries, seriesColor, type SeriesKey } from "@/lib/task-colors";

type Saved = { actionId: string | null } | { error: true } | null;

const name = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);

export default function ColorPicker({ planId, color, onChanged }: { planId: string; color: string; onChanged: () => void }) {
  const current = projectSeries(color, planId);
  const [picked, setPicked] = useState<SeriesKey | null>(null);
  const [saved, setSaved] = useState<Saved>(null);
  const shown = picked ?? current;

  async function pick(next: SeriesKey) {
    if (next === shown) return;
    setPicked(next);
    setSaved(null);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_color", planId, color: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; actionId?: string | null };
      if (!res.ok || data.ok === false) throw new Error("not saved");
      setSaved({ actionId: data.actionId ?? null });
      onChanged();
    } catch {
      setPicked(null);
      setSaved({ error: true });
    }
  }

  return (
    <fieldset className="project-color-picker">
      <legend>Color</legend>
      <div className="project-color-swatches">
        {SERIES_KEYS.map((key) => (
          <label key={key} className="project-color-swatch" title={name(key)}>
            <input
              type="radio"
              name={`project-color-${planId}`}
              value={key}
              checked={shown === key}
              aria-label={name(key)}
              onChange={() => void pick(key)}
            />
            <span style={{ background: seriesColor(key) }} aria-hidden="true" />
          </label>
        ))}
      </div>
      <div aria-live="polite">
        {saved && "error" in saved && <p className="project-color-note">Couldn&apos;t save that color. Try again.</p>}
        {saved && "actionId" in saved && saved.actionId && (
          <ActionReceipt
            actionId={saved.actionId}
            label="Color changed"
            onUndone={() => {
              setPicked(null);
              setSaved(null);
              onChanged();
            }}
          />
        )}
      </div>
    </fieldset>
  );
}
