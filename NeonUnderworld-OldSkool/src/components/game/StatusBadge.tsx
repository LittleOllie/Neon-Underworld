export type StatusBadgeTone = 'default' | 'muted' | 'success' | 'warn' | 'danger' | 'info';

export function StatusBadge({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
}) {
  return <span className={`g-status-badge g-status-badge--${tone}`}>{children}</span>;
}

/** Heat band labels — text + colour, never colour-only. */
export function heatBadgeTone(band: string): StatusBadgeTone {
  if (band === 'CRITICAL') return 'danger';
  if (band === 'HIGH') return 'warn';
  if (band === 'MODERATE') return 'warn';
  return 'success';
}
