"use client";

import { CODE_MAX_LENGTH, CODE_MIN_LENGTH, codeDigits } from "@/lib/auth/messages";

/** The email sign-in code. Supabase's code length is a project setting (6 to
 *  10 digits), so this is one field that takes any of those lengths, typed,
 *  pasted (spaces and dashes dropped) or autofilled. It never submits on its
 *  own: the student presses the button once every digit is in (Round 4, 1.4). */
export default function CodeInput({
  value,
  onChange,
  disabled,
  invalid,
  describedBy,
}: {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor="auth-code">Sign-in code</label>
      <input
        id="auth-code"
        name="code"
        className="auth-input auth-code-input"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={CODE_MAX_LENGTH + 4}
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        value={value}
        autoFocus
        placeholder={"0".repeat(CODE_MIN_LENGTH)}
        onChange={(e) => onChange(codeDigits(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          onChange(codeDigits(e.clipboardData.getData("text")));
        }}
      />
    </div>
  );
}
