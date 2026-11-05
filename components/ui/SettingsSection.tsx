import type { ReactNode } from "react";

type Props = {
  id?: string;
  title: string;
  description?: ReactNode;
  /** Shown under the card: a Save button, a FormMessage. */
  footer?: ReactNode;
  /** Extra class on the card (e.g. "knows-card"). */
  cardClassName?: string;
  children: ReactNode;
};

/** A titled group of SettingRows in one card. */
export default function SettingsSection({ id, title, description, footer, cardClassName = "", children }: Props) {
  const titleId = `${id ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-title`;
  return (
    <section id={id} className="settings-group" aria-labelledby={titleId}>
      <h2 id={titleId} className="settings-group-title">{title}</h2>
      {description && <p className="settings-group-note">{description}</p>}
      <div className={`settings-card ${cardClassName}`.trim()}>{children}</div>
      {footer && <div className="settings-section-footer">{footer}</div>}
    </section>
  );
}
