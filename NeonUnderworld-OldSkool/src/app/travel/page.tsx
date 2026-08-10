import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { TravelForm } from '@local/features/travel/TravelForm';
import { getTravelPageDataFromContext } from '@local/server/actions/travel.actions';

export default async function TravelPage() {
  const { ctx } = await requireGameSession();
  const data = await getTravelPageDataFromContext(ctx);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="travel">
      <PageTitle icon="travel">Travel</PageTitle>
      <TravelForm {...data} />
    </GameShell>
  );
}
