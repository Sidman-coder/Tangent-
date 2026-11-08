"use client";

import { useState } from "react";
import { passwordProblem, passwordRules, passwordStrength } from "@/lib/auth/password";
import "./password-fields.css";

/** One password box with a Show/Hide toggle. */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
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
  return passwordProblem(password, email) ?? (password !== confirm ? "The two passwords don't match." : null);
}

/** New password + confirm. The rules show as calm hints that turn green as
 *  each is met; the confirm box is checked only once it loses focus or the form
 *  is submitted (`submitted`), never while the student is still typing. */
export default function NewPasswordFields({
  idPrefix,
  email,
  password,
  confirm,
  onPassword,
  onConfirm,
  autoFocus,
  submitted = false,
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
  /** The form tried to submit: show the confirm mismatch even without a blur. */
  submitted?: boolean;
  label?: string;
  inputClassName?: string;
  labelClassName?: string;
}) {
  const [confirmTouched, setConfirmTouched] = useState(false);
  const rules = passwordRules(password, email);
  const strength = passwordStrength(password, email);
  const allMet = rules.every((r) => r.met);
  const mismatch = (confirmTouched || submitted) && confirm.length > 0 && confirm !== password;
  return (
    <div className="pw-fields">
      <PasswordInput
        id={`${idPrefix}-new`}
        label={label}
        value={password}
        onChange={onPassword}
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
      <div onBlur={() => setConfirmTouched(true)}>
        <PasswordInput
          id={`${idPrefix}-confirm`}
          label="Confirm password"
          value={confirm}
          onChange={onConfirm}
          autoComplete="new-password"
          invalid={mismatch}
          describedBy={mismatch ? `${idPrefix}-mismatch` : undefined}
          inputClassName={inputClassName}
          labelClassName={labelClassName}
        />
      </div>
      {mismatch && <p id={`${idPrefix}-mismatch`} className="pw-hint pw-hint--error" role="alert">The two passwords don&apos;t match.</p>}
    </div>
  );
}
