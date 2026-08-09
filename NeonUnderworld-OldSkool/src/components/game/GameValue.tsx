export type GameValueTone = 'gold' | 'positive' | 'warning' | 'danger' | 'neutral';

const VALUE_CLASS: Record<GameValueTone, string> = {
  gold: 'g-value',
  positive: 'g-value g-value--positive',
  warning: 'g-value g-value--warning',
  danger: 'g-value g-value--danger',
  neutral: 'g-value g-value--neutral',
};

export function GameLabel({ children }: { children: React.ReactNode }) {
  return <span className="g-label">{children}</span>;
}

export function GameValue({
  children,
  tone = 'gold',
}: {
  children: React.ReactNode;
  tone?: GameValueTone;
}) {
  return <span className={VALUE_CLASS[tone]}>{children}</span>;
}

export function LabelValueRow({
  label,
  value,
  tone = 'gold',
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: GameValueTone;
}) {
  return (
    <div className="g-row">
      <span className="g-label">{label}</span>
      <GameValue tone={tone}>{value}</GameValue>
    </div>
  );
}
