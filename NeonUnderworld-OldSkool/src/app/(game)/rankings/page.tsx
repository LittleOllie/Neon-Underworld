import Link from 'next/link';
import { PageTitle } from '@local/components/game';
import { EmptyState } from '@local/components/game/EmptyState';
import { OS_TERMS } from '@local/config/terminology';
import { PlayerIdentity } from '@local/components/game/PlayerIdentity';
import { requireGameSession, formatRelativeTime } from '@local/lib/game-context';
import {
  RankingsService,
  defaultRankingsFilterForDistrict,
  type RankingsFilter,
} from '@local/server/services/rankings.service';
import { devPerf } from '@local/lib/dev-perf';

const DISTRICT_FILTERS: { key: RankingsFilter; label: string }[] = [
  { key: 'neon-strip', label: 'Neon Strip' },
  { key: 'docklands', label: 'Docklands' },
  { key: 'old-quarter', label: 'Old Quarter' },
];

const FILTERS: { key: RankingsFilter; label: string }[] = [
  ...DISTRICT_FILTERS,
  { key: 'overall', label: 'Overall' },
];

function resolveFilter(param: string | undefined, districtSlug: string): RankingsFilter {
  if (param && FILTERS.some((f) => f.key === param)) {
    return param as RankingsFilter;
  }
  return defaultRankingsFilterForDistrict(districtSlug);
}

function filterHref(key: RankingsFilter): string {
  if (key === 'overall') return '/rankings?filter=overall';
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
  const filter = resolveFilter(params.filter, ctx.district.slug);

  const rows = await devPerf('/rankings data', () =>
    RankingsService.getSeasonRankings(ctx.seasonId, filter),
  );

  return (
    <>
      <PageTitle icon="rankings">Rankings</PageTitle>

      <div className="g-gameplay-controls g-rankings-chrome">
      {filter === 'overall' ? (
        <p className="g-note">
          Season-wide ranking — your header shows District Rank in {ctx.district.name}. Switch to a
          city tab for district-only standings.
        </p>
      ) : (
        <p className="g-note">
          Showing {activeFilterLabel(filter)} only — ranks below are for this city and match your
          header District Rank when you are in {ctx.district.name}.
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

      <div className="g-rank-header" aria-hidden="true">
        <span className="g-rank-num">#</span>
        <span className="g-rank-name">Operator</span>
        <span className="g-rank-worth">{OS_TERMS.influence}</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No rankings yet"
          body="Operators will appear here as the season progresses. Scout and build your empire to climb the standings."
          actionHref="/scout"
          actionLabel="Start scouting"
        />
      ) : null}

      {rows.map((p) => {
        const isYou = p.id === playerId;
        const status = lastSeenLabel(p.online, p.lastSeen);

        if (isYou) {
          return (
            <div key={p.id} className="g-rank-row g-rank-you">
              <span className="g-rank-num">#{p.rank}</span>
              <span className="g-rank-name">
                <PlayerIdentity
                  player={{
                    alias: p.alias,
                    avatar: p.identity.avatar,
                    avatarSource: p.identity.avatarSource,
                    pfpUrl: p.identity.pfpUrl,
                    themePrimary: p.identity.themePrimary,
                    themeSecondary: p.identity.themeSecondary,
                    aliasNormalized: p.aliasNormalized,
                    cartelTag: p.cartelTag,
                    city: p.city,
                  }}
                  avatarSize="rank"
                  shape="square"
                  showCartel
                  showCity
                  static
                  suffix="(you)"
                />
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
              <PlayerIdentity
                player={{
                  alias: p.alias,
                  ...p.identity,
                  aliasNormalized: p.aliasNormalized,
                  cartelTag: p.cartelTag,
                  city: p.city,
                }}
                avatarSize="rank"
                shape="square"
                showCartel
                static
              />
              <span className="g-inbox-meta"> · {status}</span>
            </span>
            <span className="g-rank-worth">${p.netWorth.toLocaleString()}</span>
          </Link>
        );
      })}
      </div>
    </>
  );
}
