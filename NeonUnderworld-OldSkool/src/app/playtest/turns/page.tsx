import { GameShell, PageTitle } from '@local/components/game';
import { requireGameSession, globalStatsFromContext } from '@local/lib/game-context';
import { AddTurnsPanel } from '@local/features/playtest/AddTurnsPanel';

export default async function PlaytestTurnsPage() {
  const { ctx } = await requireGameSession();

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="home">
      <PageTitle icon="produce">Add Turns</PageTitle>
      <AddTurnsPanel currentTurns={ctx.turns} turnCap={ctx.turnCap} />
    </GameShell>
  );
}
