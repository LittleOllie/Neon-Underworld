import { formatTurnsExact } from '@local/server/domain/status-presentation';
import { formatRank } from '@local/lib/format-rank';
import { GameLabel, GameValue } from './GameValue';

export interface ShellAttentionCounts {
  /** Unread inbox reports — drives MORE nav indicator. */
  unreadReports: number;
  /** Reserved for future MORE badges (market, cartel, etc.). */
  total: number;
}

export interface GlobalStats {
  cash: number;
  bankCash?: number;
  turns: number;
  turnCap: number;
  netWorth: number;
  /** Current district leaderboard rank (primary player-facing rank). */
  rank: number;
  overallRank?: number;
  alias?: string;
  district?: string;
  avatarId?: string;
  workers?: number;
  thugs?: number;
  attention?: ShellAttentionCounts;
}

export function GlobalStatus({ stats }: { stats: GlobalStats }) {
  const items = [
    { label: 'Cash', value: `$${stats.cash.toLocaleString()}`, className: undefined as string | undefined },
    { label: 'Turns', value: formatTurnsExact(stats.turns, stats.turnCap), className: undefined as string | undefined },
    { label: 'Net Worth', value: `$${stats.netWorth.toLocaleString()}`, className: undefined as string | undefined },
    {
      label: 'District Rank',
      shortLabel: 'Dist. Rank',
      value: formatRank(stats.rank),
      className: 'g-status-item--district-rank',
    },
  ];

  return (
    <div className="g-status-wrap">
      <div className="g-status" aria-label="Player status">
        {items.map((item) => (
          <span
            key={item.label}
            className={`g-status-item${item.className ? ` ${item.className}` : ''}`}
          >
            <GameLabel>
              <span className="g-label-long">{item.label}</span>
              {'shortLabel' in item && item.shortLabel ? (
                <span className="g-label-short">{item.shortLabel}</span>
              ) : null}
            </GameLabel>{' '}
            <GameValue>{item.value}</GameValue>
          </span>
        ))}
      </div>
    </div>
  );
}
