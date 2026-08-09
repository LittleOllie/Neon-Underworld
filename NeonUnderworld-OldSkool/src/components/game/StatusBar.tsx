import { semanticLevelFromPercent } from '@local/server/domain/status-presentation';

export function StatusBar({
  label,
  percent,
  right,
}: {
  label: string;
  percent: number;
  right?: string;
}) {
  const level = semanticLevelFromPercent(percent);
  const clamped = Math.round(Math.max(0, Math.min(100, percent)));

  return (
    <div className="g-bar-wrap">
      <div className="g-bar-head">
        <span>{label}</span>
        <span>{right ?? `${clamped}%`}</span>
      </div>
      <div className={`g-bar g-bar-${level}`}>
        <span className="g-bar-fill" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
