import Link from 'next/link';
import { PageTitle } from '@local/components/game';
import { requireGameSession, formatRelativeTime } from '@local/lib/game-context';
import { RankingsService, type RankingsFilter } from '@local/server/services/rankings.service';
import { devPerf } from '@local/lib/dev-perf';

const FILTERS: { key: RankingsFilter; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'neon-strip', label: 'Neon Strip' },
  { key: 'docklands', label: 'Docklands' },
  { key: 'old-quarter', label: 'Old Quarter' },
];

function resolveFilter(param: string | undefined): RankingsFilter {
  if (param && FILTERS.some((f) => f.key === param)) {
    return param as RankingsFilter;
  }
  return 'overall';
}

function filterHref(key: RankingsFilter): string {
  if (key === 'overall') return '/rankings';
  return `/rankings?filter=${key}`;
}

function activeFilterLabel(filter: RankingsFilter): string {
  return FILTERS.find((f) => f.key === filter)?.label ?? 'Rankings';
}

interface Props {
  searchParams: Promise<{ filter?: string }>;
}

function lastSeenLabel(online: boolean, lastSeen: Date | null): string {
  if (online) return 'Online';
  if (!lastSeen) return 'Offline';
  return formatRelativeTime(lastSeen);
}

export default async function RankingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const playerId = ctx.id;
  const filter = resolveFilter(params.filter);

  const rows = await devPerf('/rankings data', () =>
    RankingsService.getSeasonRankings(ctx.seasonId, filter),
  );

  return (
    <>
      <PageTitle icon="rankings">Rankings</PageTitle>
      {filter !== 'overall' && (
        <p className="g-note">
          Showing {activeFilterLabel(filter)} only — ranks below are for this city. Switch to Overall
          for season-wide ranking (matches your header rank).
        </p>
      )}

      <div className="g-filter-row">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={filterHref(f.key)}
            className={`g-filter${filter === f.key ? ' g-filter-active' : ''}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.map((p) => {
        const isYou = p.id === playerId;
        const status = lastSeenLabel(p.online, p.lastSeen);

        if (isYou) {
          return (
            <div key={p.id} className="g-rank-row g-rank-you">
              <span className="g-rank-num">#{p.rank}</span>
              <span className="g-rank-name">
                {p.alias} (you)
                <span className="g-inbox-meta"> · {p.city}{p.cartelTag ? ` · [${p.cartelTag}]` : ''}</span>
              </span>
              <span className="g-rank-worth">${p.netWorth.toLocaleString()}</span>
            </div>
          );
        }

        return (
          <Link
            key={p.id}
            href={`/players/${p.aliasNormalized}`}
            className="g-rank-row g-rank-link"
          >
            <span className="g-rank-num">#{p.rank}</span>
            <span className="g-rank-name">
              {p.alias}
              <span className="g-inbox-meta">
                {' '}
                · {p.city}
                {p.cartelTag ? ` · [${p.cartelTag}]` : ''} · {status}
              </span>
            </span>
            <span className="g-rank-worth">${p.netWorth.toLocaleString()}</span>
          </Link>
        );
      })}
    </>
  );
}
