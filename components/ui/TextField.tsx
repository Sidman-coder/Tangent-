import type { InputHTMLAttributes } from "react";

/** A settings text input; label it with SettingRow htmlFor or aria-label. */
export default function TextField({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`settings-input ${className}`.trim()} />;
}
