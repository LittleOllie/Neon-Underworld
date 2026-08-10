import { formatTurnsExact } from '@local/server/domain/status-presentation';
import { formatRank } from '@local/lib/format-rank';
import { GameLabel, GameValue } from './GameValue';

export interface GlobalStats {
  cash: number;
  bankCash?: number;
  turns: number;
  turnCap: number;
  netWorth: number;
  rank: number;
  alias?: string;
  district?: string;
}

export function GlobalStatus({ stats }: { stats: GlobalStats }) {
  const items = [
    { label: 'Cash', value: `$${stats.cash.toLocaleString()}` },
    { label: 'Turns', value: formatTurnsExact(stats.turns, stats.turnCap) },
    { label: 'Net Worth', value: `$${stats.netWorth.toLocaleString()}` },
    { label: 'Rank', value: formatRank(stats.rank) },
  ];

  return (
    <div className="g-status" aria-label="Player status">
      {items.map((item) => (
        <span key={item.label} className="g-status-item">
          <GameLabel>{item.label}</GameLabel>{' '}
          <GameValue>{item.value}</GameValue>
        </span>
      ))}
    </div>
  );
}
