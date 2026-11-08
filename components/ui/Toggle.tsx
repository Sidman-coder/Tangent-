"use client";

type Props = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
};

/** An on/off switch. Saves as soon as it flips; pair with a "Saved" message. */
export default function Toggle({ checked, onChange, label, disabled, id }: Props) {
  return (
    <button
      id={id}
      type="button"
      className={`toggle-switch${checked ? " on" : ""}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  );
}
