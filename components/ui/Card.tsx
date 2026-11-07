import type { HTMLAttributes, ReactNode } from "react";

type CardProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  variant?: "outlined" | "plain" | "muted";
  as?: "section" | "div" | "article" | "aside";
  /** Header title (15px / 600). */
  title?: ReactNode;
  titleId?: string;
  /** Header action at the right. */
  action?: ReactNode;
};

/** docs/design/TANGENT-STYLE.md §8 Card. No shadow; cards never nest. */
export default function Card({ variant = "outlined", as: Tag = "section", title, titleId, action, className = "", children, ...props }: CardProps) {
  return (
    <Tag
      {...props}
      className={`ui-card ui-card--${variant} ${className}`.trim()}
      aria-labelledby={title && titleId ? titleId : props["aria-labelledby"]}
    >
      {(title || action) && (
        <header className="ui-card-header">
          {title && (
            <h2 className="ui-card-title" id={titleId}>
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      {children}
    </Tag>
  );
}
