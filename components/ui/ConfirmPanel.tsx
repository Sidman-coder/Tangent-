"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Button from "./Button";

type Props = {
  title: string;
  children: ReactNode;
  /** The word to type, e.g. "DELETE". Leave out for a plain two-button check. */
  word?: string;
  actionLabel: string;
  busyLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** An inline confirmation for something that can't be undone: say what goes,
 *  then type a word to unlock the button. No browser dialog. */
export default function ConfirmPanel({ title, children, word, actionLabel, busyLabel = "Working…", busy = false, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => (word ? input.current : actions.current?.querySelector("button"))?.focus(), [word]);
  const ready = !word || typed.trim().toUpperCase() === word.toUpperCase();

  return (
    <div className="confirm-panel" role="group" aria-labelledby={`${inputId}-title`}>
      <p id={`${inputId}-title`} className="confirm-panel-title">{title}</p>
      <div className="confirm-panel-body">{children}</div>
      <form
        className="confirm-panel-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready && !busy) onConfirm();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        {word && (
          <>
            <label htmlFor={inputId}>
              Type <strong>{word}</strong> to confirm
            </label>
            <input
              ref={input}
              id={inputId}
              className="settings-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </>
        )}
        <div ref={actions} className="confirm-panel-actions">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="submit" variant="danger" size="sm" disabled={!ready} loading={busy} loadingLabel={busyLabel}>{actionLabel}</Button>
        </div>
      </form>
    </div>
  );
}
