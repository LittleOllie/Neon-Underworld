import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { ScoutForm } from '@local/features/scout/ScoutForm';

export default async function ScoutPage() {
  const { ctx } = await requireGameSession();

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="scout">
      <PageTitle icon="scout">Scout</PageTitle>
      <ScoutForm initialTurns={ctx.turns} />
    </GameShell>
  );
}
