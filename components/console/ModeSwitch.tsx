"use client";

// Plan / Calendar segmented switch for the composer. A thumb slides between
// the two options; Calendar lights up in the accent so it's obvious the
// next message will change the calendar.

import { CalendarPlus, Lightbulb } from "lucide-react";
import type { ChatMode } from "@/components/console/turns";

const OPTIONS: { mode: ChatMode; label: string; icon: typeof Lightbulb; hint: string }[] = [
  { mode: "plan", label: "Plan", icon: Lightbulb, hint: "Talk a plan through — nothing is added" },
  { mode: "calendar", label: "Calendar", icon: CalendarPlus, hint: "Add and change tasks on your calendar" },
];

type Props = {
  mode: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
};

export default function ModeSwitch({ mode, onChange, disabled }: Props) {
  return (
    <div className={`tg-mode is-${mode}`} role="radiogroup" aria-label="Chat mode">
      <span className="tg-mode-thumb" aria-hidden="true" />
      {OPTIONS.map(({ mode: m, label, icon: Icon, hint }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          title={hint}
          className={`tg-mode-opt${mode === m ? " is-on" : ""}`}
          disabled={disabled}
          onClick={() => onChange(m)}
        >
          <Icon size={14} strokeWidth={2} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
