import Link from 'next/link';
import { prisma } from '@core/lib/db/prisma';
import { GameShell, PageTitle } from '@local/components/game';
import { globalStatsFromContext, formatRelativeTime, requireGameSession } from '@local/lib/game-context';
import { RankingsService, type RankingsFilter } from '@local/server/services/rankings.service';

const FILTERS: { key: RankingsFilter; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'neon-strip', label: 'Neon Strip' },
  { key: 'docklands', label: 'Docklands' },
  { key: 'old-quarter', label: 'Old Quarter' },
];

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
  const filterParam = params.filter ?? 'overall';
  const filter = (FILTERS.some((f) => f.key === filterParam) ? filterParam : 'overall') as RankingsFilter;

  const { ctx } = await requireGameSession();
  const stats = globalStatsFromContext(ctx);
  const playerId = ctx.id;

  const season = await prisma.season.findFirst({ where: { status: 'ACTIVE' } });

  if (!season) {
    return (
      <GameShell stats={stats} background="rankings">
        <PageTitle icon="rankings">Rankings</PageTitle>
        <p className="g-note">No active season.</p>
      </GameShell>
    );
  }

  const rows = await RankingsService.getSeasonRankings(season.id, filter);

  return (
    <GameShell stats={stats} background="rankings">
      <PageTitle icon="rankings">Rankings</PageTitle>

      <div className="g-filter-row">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'overall' ? '/rankings' : `/rankings?filter=${f.key}`}
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
                <span className="g-inbox-meta"> · {p.city}</span>
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
                · {p.city} · {status}
              </span>
            </span>
            <span className="g-rank-worth">${p.netWorth.toLocaleString()}</span>
          </Link>
        );
      })}
    </GameShell>
  );
}
