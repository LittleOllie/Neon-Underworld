import { semanticLevelFromHeatScore } from '@local/lib/business-heat-display';

export function HeatStatusBar({
  label,
  score,
  right,
}: {
  label: string;
  score: number;
  right?: string;
}) {
  const level = semanticLevelFromHeatScore(score);
  const clamped = Math.round(Math.max(0, Math.min(100, score)));

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
