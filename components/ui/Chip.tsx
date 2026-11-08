import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type ChipVariant = "filter" | "project" | "meta" | "status";
export type ChipTone = "success" | "warning" | "error" | "info";

type ChipProps = {
  variant?: ChipVariant;
  children: ReactNode;
  /** filter: pressed state. */
  selected?: boolean;
  /** project: the series color for the dot (a CSS color or var()). */
  color?: string;
  /** status: which tone icon and color. */
  tone?: ChipTone;
  icon?: ReactNode;
  /** Renders a button. Filters announce aria-pressed. */
  onClick?: () => void;
  disabled?: boolean;
  /** Full text for a name that may truncate. Defaults to the label when it is a string. */
  title?: string;
  className?: string;
};

const TONE_ICON = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info } as const;

/** docs/design/TANGENT-STYLE.md §8 Chip / Tag. Never wraps; long names truncate. */
export default function Chip({
  variant = "meta",
  children,
  selected,
  color,
  tone = "info",
  icon,
  onClick,
  disabled,
  title,
  className = "",
}: ChipProps) {
  const ToneIcon = variant === "status" ? TONE_ICON[tone] : null;
  const cls = `ui-chip ui-chip--${variant}${variant === "status" ? ` is-${tone}` : ""}${selected ? " is-selected" : ""} ${className}`.trim();
  const style = color ? ({ "--chip-color": color } as CSSProperties) : undefined;
  const fullTitle = title ?? (typeof children === "string" ? children : undefined);
  const content = (
    <>
      {variant === "project" && <span className="ui-chip-dot" aria-hidden="true" />}
      {ToneIcon ? <ToneIcon strokeWidth={1.75} aria-hidden="true" /> : icon}
      <span className="ui-chip-label">{children}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        onClick={onClick}
        disabled={disabled}
        title={fullTitle}
        aria-pressed={variant === "filter" ? Boolean(selected) : undefined}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={cls} style={style} title={fullTitle}>
      {content}
    </span>
  );
}
