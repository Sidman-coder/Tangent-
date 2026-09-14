import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
};

export default function PageHeader({ title, description, eyebrow, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow && <span className="page-header-eyebrow">{eyebrow}</span>}
        <h1 className="page-header-title">{title}</h1>
        {description && <div className="page-header-description">{description}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
