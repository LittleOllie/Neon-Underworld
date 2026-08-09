import Link from 'next/link';
import {
  GameShell,
  PageTitle,
  StatusBar,
  AlertList,
  ActionButton,
} from '@local/components/game';
import {
  requireGameSession,
  globalStatsFromContext,
  buildAttentionItems,
  prioritizeAttentionItems,
} from '@local/lib/game-context';
import { PlayerService } from '@local/server/services/player.service';

export default async function CommandPage() {
  const { playerId, ctx } = await requireGameSession();
  const attentionAll = await buildAttentionItems(ctx);

  await PlayerService.recordLoginIfNeeded(playerId, ctx.alias);

  const { visible: alerts } = prioritizeAttentionItems(attentionAll, 5);

  return (
    <GameShell stats={globalStatsFromContext(ctx)} background="home">
      <PageTitle icon="home">Home</PageTitle>

      <StatusBar label="Health" percent={ctx.health} />

      <AlertList items={alerts} />

      <div className="g-actions">
        <ActionButton href="/scout" icon="scout">
          Scout
        </ActionButton>
        <ActionButton href="/produce" icon="produce">
          Produce
        </ActionButton>
        <ActionButton href="/shop" icon="shop">
          Shop
        </ActionButton>
        <ActionButton href="/rankings" icon="rankings">
          Rankings
        </ActionButton>
      </div>
    </GameShell>
  );
}
