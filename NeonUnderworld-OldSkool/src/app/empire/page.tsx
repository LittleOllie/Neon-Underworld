import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { EmpireService } from '@local/server/services/empire.service';
import { EmpireSimpleView } from '@local/features/empire/EmpireSimpleView';

export default async function EmpirePage() {
  const { playerId, ctx } = await requireGameSession();
  const data = await EmpireService.getManagementData(playerId);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="empire">
      <PageTitle icon="empire">Empire</PageTitle>
      <EmpireSimpleView data={data} />
    </GameShell>
  );
}
