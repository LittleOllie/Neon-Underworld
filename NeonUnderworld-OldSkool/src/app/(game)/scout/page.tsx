import { PageTitle } from '@local/components/game';
import { RoutePrefetch } from '@local/components/game/RoutePrefetch';
import { requireGameSession } from '@local/lib/game-context';
import { ScoutForm } from '@local/features/scout/ScoutForm';

export default async function ScoutPage() {
  const { ctx } = await requireGameSession();

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
      />
    </>
  );
}
