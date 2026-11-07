import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  /** At most one secondary button. */
  action?: ReactNode;
  className?: string;
};

/** docs/design/TANGENT-STYLE.md §8 Empty state: centered, never a tinted card. */
export default function EmptyState({ icon, title, children, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`ui-empty ${className}`.trim()}>
      <span className="ui-empty-icon" aria-hidden="true">
        {icon}
      </span>
      <p className="ui-empty-title">{title}</p>
      {children && <p className="ui-empty-body">{children}</p>}
      {action && <div className="ui-empty-action">{action}</div>}
    </div>
  );
}
