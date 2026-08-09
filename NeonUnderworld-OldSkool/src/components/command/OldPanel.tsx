import type { ReactNode } from 'react';

interface OldPanelProps {
  title?: string;
  children: ReactNode;
  className?: string;
  quiet?: boolean;
}

export function OldPanel({ title, children, className = '', quiet }: OldPanelProps) {
  return (
    <section className={`old-panel ${quiet ? 'old-panel--quiet' : ''} ${className}`.trim()}>
      {title && <header className="old-panel-title">{title}</header>}
      <div className="old-panel-body">{children}</div>
    </section>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="old-section-header">
      <h2 className="old-section-title">{title}</h2>
      {subtitle && <p className="old-section-subtitle">{subtitle}</p>}
    </div>
  );
}

export function StatBox({
  label,
  value,
  highlight,
  hero,
  variant,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  hero?: boolean;
  variant?: 'cash';
}) {
  const classes = [
    'old-stat-box',
    hero && 'old-stat-box--hero',
    variant === 'cash' && 'old-stat-box--cash',
    highlight && !hero && 'old-stat-box--highlight',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <span className="old-stat-label">{label}</span>
      <span className="old-stat-value">{value}</span>
    </div>
  );
}

export function NotificationBar({ message }: { message: string }) {
  return (
    <div className="old-notification" role="status">
      <span className="old-notification-icon">!</span>
      {message}
    </div>
  );
}
