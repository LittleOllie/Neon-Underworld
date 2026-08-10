import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { CartelPanel } from '@local/features/cartels/CartelPanel';
import { getCartelPageData } from '@local/server/actions/cartel.actions';

export default async function CartelsPage() {
  const { ctx } = await requireGameSession();
  const data = await getCartelPageData(ctx.id);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="cartel">
      <PageTitle icon="cartel">Cartels</PageTitle>
      <CartelPanel {...data} />
    </GameShell>
  );
}
