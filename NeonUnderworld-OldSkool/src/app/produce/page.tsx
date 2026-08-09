import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { ProduceForm } from '@local/features/produce/ProduceForm';

export default async function ProducePage() {
  const { ctx } = await requireGameSession();

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="produce">
      <PageTitle icon="produce">Produce</PageTitle>
      <ProduceForm initialTurns={ctx.turns} thugCount={ctx.thugs} />
    </GameShell>
  );
}
