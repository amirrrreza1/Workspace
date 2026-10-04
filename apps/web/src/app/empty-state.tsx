import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
};

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">
        {icon}
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actions ? <div className="empty-actions">{actions}</div> : null}
    </section>
  );
}
