import type { SelectHTMLAttributes } from "react";

type Option = { value: string; label: string };

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  options: readonly Option[];
};

/** A settings dropdown. */
export default function Select({ options, className = "", ...props }: Props) {
  return (
    <select {...props} className={`settings-select ${className}`.trim()}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
