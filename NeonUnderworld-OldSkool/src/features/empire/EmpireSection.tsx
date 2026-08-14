import type { ReactNode } from 'react';

type EmpireSectionProps = {
  title: string;
  badge?: string;
  children: ReactNode;
};

/** Collapsed-by-default empire accordion — reuses Businesses section styling. */
export function EmpireSection({ title, badge, children }: EmpireSectionProps) {
  return (
    <details className="g-business-section g-empire-section">
      <summary className="g-business-section-summary">
        <span className="g-business-section-chevron" aria-hidden />
        <span className="g-business-section-title">{title}</span>
        {badge ? <span className="g-business-section-badge">{badge}</span> : null}
      </summary>
      <div className="g-business-section-body">{children}</div>
    </details>
  );
}
