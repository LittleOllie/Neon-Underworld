import { PageTitle } from '@local/components/game';
import { RoutePrefetch } from '@local/components/game/RoutePrefetch';
import { requireGameSession, loadBusinessNetworkBonus } from '@local/lib/game-context';
import { ScoutForm } from '@local/features/scout/ScoutForm';
import {
  REDLITE_SCOUT_AREAS,
  type RedliteScoutAreaSlug,
} from '@core/config/game/redlite-rules';

const SCOUT_AREA_SLUGS = new Set<string>(REDLITE_SCOUT_AREAS.map((a) => a.slug));

interface Props {
  searchParams: Promise<{ turns?: string; area?: string }>;
}

export default async function ScoutPage({ searchParams }: Props) {
  const { ctx } = await requireGameSession();
  const params = await searchParams;

  const prefilledTurns = parsePositiveInt(params.turns);
  const prefilledArea = parseArea(params.area);
  const businessNetwork =
    ctx.businesses > 0 ? await loadBusinessNetworkBonus(ctx.id) : null;

  return (
    <>
      <RoutePrefetch href="/attack" />
      <PageTitle icon="scout">Scout</PageTitle>
      <ScoutForm
        districtSlug={ctx.district.slug}
        initialTurns={ctx.turns}
        prostituteHappiness={ctx.prostituteHappiness.score}
        thugHappiness={ctx.thugHappiness.score}
        prostituteCount={ctx.prostitutes}
        thugCount={ctx.thugs}
        prefilledTurns={prefilledTurns}
        prefilledArea={prefilledArea}
        businessNetwork={businessNetwork}
      />
    </>
  );
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function parseArea(raw: string | undefined): RedliteScoutAreaSlug | undefined {
  if (!raw || !SCOUT_AREA_SLUGS.has(raw)) return undefined;
  return raw as RedliteScoutAreaSlug;
}
