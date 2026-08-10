import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { AddTurnsPanel } from '@local/features/playtest/AddTurnsPanel';

export default async function PlaytestTurnsPage() {
  const { ctx } = await requireGameSession();

  return (
    <>
      <PageTitle icon="produce">Add Turns</PageTitle>
      <AddTurnsPanel currentTurns={ctx.turns} turnCap={ctx.turnCap} />
    </>
  );
}
