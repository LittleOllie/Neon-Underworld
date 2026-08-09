import { GameValue, type GameValueTone } from './GameValue';

export function StatRow({
  label,
  value,
  valueTone = 'gold',
}: {
  label: string;
  value: React.ReactNode;
  valueTone?: GameValueTone | 'inherit';
}) {
  return (
    <div className="g-row">
      <span className="g-label">{label}</span>
      {valueTone === 'inherit' ? (
        <span className="g-row-value">{value}</span>
      ) : (
        <GameValue tone={valueTone}>{value}</GameValue>
      )}
    </div>
  );
}
