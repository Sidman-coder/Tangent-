import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

type GroupHeaderProps = {
  variant?: "project" | "time";
  title: ReactNode;
  /** project: the series color for the 8px dot. */
  color?: string;
  /** time: an 18px lucide icon (Sunrise, Sun, Sunset, Moon, Infinity). */
  icon?: ReactNode;
  /** time: "12 PM – 5 PM". */
  range?: ReactNode;
  count?: number;
  /** project: the header links here, with a chevron on hover. */
  href?: string;
  /** Collapsible: pass both. */
  collapsed?: boolean;
  onToggle?: () => void;
  /** id of the list this header toggles (aria-controls). */
  controls?: string;
  action?: ReactNode;
  as?: "h2" | "h3" | "div";
  className?: string;
};

/** docs/design/TANGENT-STYLE.md §8 Project group header and Time-of-day header. */
export default function GroupHeader({
  variant = "project",
  title,
  color,
  icon,
  range,
  count,
  href,
  collapsed,
  onToggle,
  controls,
  action,
  as: Tag = "h3",
  className = "",
}: GroupHeaderProps) {
  const style = color ? ({ "--group-color": color } as CSSProperties) : undefined;
  const lead = (
    <>
      {variant === "project" && <span className="ui-group-header-dot" aria-hidden="true" />}
      {variant === "time" && icon && (
        <span className="ui-group-header-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="ui-group-header-title">{title}</span>
      {range && <span className="ui-group-header-range">{range}</span>}
    </>
  );
  const countEl =
    typeof count === "number" ? (
      <span className="ui-group-header-count">
        {count}
        <span className="ui-visually-hidden">{count === 1 ? " item" : " items"}</span>
      </span>
    ) : null;

  let body: ReactNode;
  if (onToggle) {
    body = (
      <button type="button" className="ui-group-header-toggle" aria-expanded={!collapsed} aria-controls={controls} onClick={onToggle}>
        {lead}
        {countEl}
        <ChevronDown className="ui-group-header-chevron" size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    );
  } else if (href) {
    body = (
      <>
        <Link href={href} className="ui-group-header-link">
          {lead}
          <ChevronRight className="ui-group-header-chevron" size={16} strokeWidth={1.75} aria-hidden="true" />
        </Link>
        {countEl}
      </>
    );
  } else {
    body = (
      <>
        {lead}
        {countEl}
      </>
    );
  }

  return (
    <Tag className={`ui-group-header ui-group-header--${variant} ${className}`.trim()} style={style}>
      {body}
      {action && <span className="ui-group-header-action">{action}</span>}
    </Tag>
  );
}
