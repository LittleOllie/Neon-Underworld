import { semanticToneFromBandLabel } from '@local/server/domain/status-presentation';

export function StatusValue({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'good' | 'warn' | 'danger';
}) {
  const className = tone ? `g-status-val g-status-val--${tone}` : 'g-status-val';
  return <span className={className}>{children}</span>;
}

export function StatusValueFromLabel({ label }: { label: string }) {
  const tone = semanticToneFromBandLabel(label);
  return <StatusValue tone={tone}>{label}</StatusValue>;
}
