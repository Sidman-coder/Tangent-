import type { ReactNode } from "react";

type Props = {
  label: ReactNode;
  help?: ReactNode;
  /** The id of the control, so the label is clickable and read out with it. */
  htmlFor?: string;
  /** Control under the label instead of beside it (wide editors). */
  stacked?: boolean;
  children?: ReactNode;
};

/** One settings line: label and help on the left, one control on the right. */
export default function SettingRow({ label, help, htmlFor, stacked = false, children }: Props) {
  const copy = (
    <>
      <strong>{label}</strong>
      {help && <span>{help}</span>}
    </>
  );
  return (
    <div className={`settings-row${stacked ? " is-stacked" : ""}`}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="settings-row-copy">{copy}</label>
      ) : (
        <div className="settings-row-copy">{copy}</div>
      )}
      {children !== undefined && <div className="settings-row-control">{children}</div>}
    </div>
  );
}
