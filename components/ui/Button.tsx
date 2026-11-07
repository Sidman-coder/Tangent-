import type { ButtonHTMLAttributes, ReactNode } from "react";

/** "quiet" is the old name for "ghost" and still works. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "quiet" | "danger" | "danger-quiet";
export type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Read by screen readers while loading; the visible label stays. */
  loadingLabel?: string;
  icon?: ReactNode;
};

/** docs/design/TANGENT-STYLE.md §8 Button. One primary per view. */
export default function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  loadingLabel,
  icon,
  className = "",
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="ui-button-spinner" aria-hidden="true" /> : icon}
      {children != null && children !== false && <span>{children}</span>}
      {loading && loadingLabel && <span className="ui-visually-hidden" role="status">{loadingLabel}</span>}
    </button>
  );
}
