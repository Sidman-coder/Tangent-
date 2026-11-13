"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { passwordProblem, passwordRules, passwordStrength } from "@/lib/auth/password";
import { PASSWORD_MISMATCH, confirmReducer, confirmView, initialConfirmState } from "@/lib/auth/confirm-state";
import "./password-fields.css";

/** One password box with a Show/Hide toggle. `onBlur` fires when focus leaves
 *  the text box itself, not when it moves to the Show/Hide button. */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  autoFocus,
  invalid,
  describedBy,
  inputClassName,
  labelClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  autoComplete: "current-password" | "new-password";
  autoFocus?: boolean;
  invalid?: boolean;
  describedBy?: string;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pw-field">
      <label className={labelClassName ?? "pw-label"} htmlFor={id}>{label}</label>
      <div className="pw-wrap">
        <input
          id={id}
          className={`${inputClassName ?? "pw-input"} pw-input-with-toggle`}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          spellCheck={false}
          autoCapitalize="none"
          value={value}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
        <button
          type="button"
          className="pw-toggle"
          aria-pressed={shown}
          aria-controls={id}
          aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

/** Why the new password + confirm pair can't be saved yet, or null. */
export function newPasswordProblem(password: string, confirm: string, email?: string | null): string | null {
  return passwordProblem(password, email) ?? (password !== confirm ? PASSWORD_MISMATCH : null);
}

/** New password + confirm. The rules show as calm hints that turn green as
 *  each is met. The confirm box complains only once it loses focus or the form
 *  is submitted (`submitTick` goes up), hides again the moment either box is
 *  edited, and says "Passwords match" in green when they do. The rule lives in
 *  lib/auth/confirm-state.ts. */
export default function NewPasswordFields({
  idPrefix,
  email,
  password,
  confirm,
  onPassword,
  onConfirm,
  autoFocus,
  submitTick = 0,
  label = "New password",
  inputClassName,
  labelClassName,
}: {
  idPrefix: string;
  email?: string | null;
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  autoFocus?: boolean;
  /** Goes up by one each time the form tries to submit: show the confirm
   *  mismatch even without a blur. */
  submitTick?: number;
  label?: string;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [confirmState, dispatch] = useReducer(confirmReducer, initialConfirmState);
  const lastTick = useRef(submitTick);
  useEffect(() => {
    if (submitTick !== lastTick.current) {
      lastTick.current = submitTick;
      dispatch("submit");
    }
  }, [submitTick]);

  const rules = passwordRules(password, email);
  const strength = passwordStrength(password, email);
  const allMet = rules.every((r) => r.met);
  const view = confirmView(password, confirm, confirmState);
  const mismatch = view === "mismatch";
  const hintId = view === "idle" ? undefined : `${idPrefix}-confirm-hint`;
  return (
    <div className="pw-fields">
      <PasswordInput
        id={`${idPrefix}-new`}
        label={label}
        value={password}
        onChange={(v) => {
          dispatch("editPassword");
          onPassword(v);
        }}
        autoComplete="new-password"
        autoFocus={autoFocus}
        describedBy={`${idPrefix}-rules`}
        inputClassName={inputClassName}
        labelClassName={labelClassName}
      />
      <ul id={`${idPrefix}-rules`} className="pw-rules" aria-label="Password rules">
        {rules.map((r) => (
          <li key={r.id} className={`pw-rule${r.met ? " pw-rule--met" : ""}`}>
            <span className="pw-rule-mark" aria-hidden="true">{r.met ? "✓" : "•"}</span>
            {r.label}
            <span className="sr-only">{r.met ? " (done)" : " (not yet)"}</span>
          </li>
        ))}
        {allMet && strength.score > 0 && (
          <li className="pw-rule pw-rule--strength" aria-live="polite">
            <span className={`pw-meter pw-meter--${strength.score}`} aria-hidden="true"><span /><span /><span /></span>
            {strength.label}
          </li>
        )}
      </ul>
      <PasswordInput
        id={`${idPrefix}-confirm`}
        label="Confirm password"
        value={confirm}
        onChange={(v) => {
          dispatch("editConfirm");
          onConfirm(v);
        }}
        onBlur={() => dispatch("blur")}
        autoComplete="new-password"
        invalid={mismatch}
        describedBy={hintId}
        inputClassName={inputClassName}
        labelClassName={labelClassName}
      />
      {mismatch && <p id={hintId} className="pw-hint pw-hint--error" role="alert">{PASSWORD_MISMATCH}</p>}
      {view === "match" && (
        <p id={hintId} className="pw-hint pw-hint--ok" role="status">
          <span aria-hidden="true">✓</span> Passwords match
        </p>
      )}
    </div>
  );
}
