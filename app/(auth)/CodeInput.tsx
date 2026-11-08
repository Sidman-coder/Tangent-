"use client";

import { useRef } from "react";

const LENGTH = 6;

/** Six one-digit boxes for the email sign-in code. Typing moves forward,
 *  Backspace moves back, and pasting the whole code fills every box. Calls
 *  onComplete once all six digits are in. */
export default function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? "");

  const set = (code: string, focus: number) => {
    const clean = code.replace(/\D/g, "").slice(0, LENGTH);
    onChange(clean);
    refs.current[Math.min(focus, LENGTH - 1)]?.focus();
    if (clean.length === LENGTH) onComplete(clean);
  };

  return (
    <div className="auth-code" role="group" aria-label="6-digit sign-in code">
      {digits.map((d, i) => (
        <input
          name={`code-digit-${i + 1}`}
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="auth-code-box"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={i === 0 ? LENGTH : 1}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          value={d}
          autoFocus={i === 0}
          onChange={(e) => {
            const typed = e.target.value.replace(/\D/g, "");
            if (!typed) return;
            // A whole code typed or autofilled into one box fills from there.
            const next = (value.slice(0, i) + typed + value.slice(i + typed.length)).slice(0, LENGTH);
            set(next, i + typed.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d) set(value.slice(0, i) + value.slice(i + 1), i);
              else if (i > 0) set(value.slice(0, i - 1) + value.slice(i), i - 1);
            } else if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
            if (pasted) set(pasted, pasted.length);
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
