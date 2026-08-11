import { redirect } from 'next/navigation';
import { PageTitle } from '@local/components/game';
import { requireGameSession } from '@local/lib/game-context';
import { isPlaytestTurnsEnabled } from '@core/config/game/playtest';
import { AddTurnsPanel } from '@local/features/playtest/AddTurnsPanel';

export default async function PlaytestTurnsPage() {
  if (!isPlaytestTurnsEnabled()) {
    redirect('/command');
  }

  const { ctx } = await requireGameSession();

  return (
    <>
      <PageTitle icon="produce">Add Turns</PageTitle>
      <AddTurnsPanel currentTurns={ctx.turns} turnCap={ctx.turnCap} />
    </>
  );
}
