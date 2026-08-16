import Link from 'next/link';
import { Suspense } from 'react';
import { PageTitle } from '@local/components/game';
import { RouteLoadingState } from '@local/components/game/RouteLoadingState';
import { requireGameSession } from '@local/lib/game-context';
import {
  defaultRankingsFilterForDistrict,
  type RankingsFilter,
} from '@local/server/services/rankings.service';
import { RankingsList } from '@local/features/rankings/RankingsList';

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

export default async function RankingsPage({ searchParams }: Props) {
  const params = await searchParams;
  const { ctx } = await requireGameSession();
  const playerId = ctx.id;
  const filter = resolveFilter(params.filter, ctx.district.slug);

  return (
    <>
      <PageTitle icon="rankings">Rankings</PageTitle>
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

      <Suspense fallback={<RouteLoadingState />}>
        <RankingsList seasonId={ctx.seasonId} playerId={playerId} filter={filter} />
      </Suspense>
    </>
  );
}
