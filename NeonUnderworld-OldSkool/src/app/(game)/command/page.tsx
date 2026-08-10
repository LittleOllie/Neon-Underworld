import {
  PageTitle,
  StatusBar,
  AlertList,
  ActionButton,
  HomeCrewSummary,
} from '@local/components/game';
import {
  requireGameSession,
  buildAttentionItems,
  prioritizeAttentionItems,
} from '@local/lib/game-context';
import { PlayerService } from '@local/server/services/player.service';
import { devPerf } from '@local/lib/dev-perf';
import { isRoutePrefetch } from '@local/lib/is-route-prefetch';

export default async function CommandPage() {
  const { playerId, ctx } = await requireGameSession();
  const prefetch = await isRoutePrefetch();

  const attentionAll = await devPerf('/command attention', async () => {
    const [items] = await Promise.all([
      buildAttentionItems(ctx),
      prefetch ? Promise.resolve() : PlayerService.recordLoginIfNeeded(playerId, ctx.alias),
    ]);
    return items;
  });

  const { visible: alerts } = prioritizeAttentionItems(attentionAll, 5);

  return (
    <>
      <PageTitle icon="home">Home</PageTitle>

      <HomeCrewSummary
        workers={ctx.prostitutes}
        thugs={ctx.thugs}
        workerHappiness={ctx.prostituteHappiness.score}
        thugHappiness={ctx.thugHappiness.score}
      />

      <StatusBar label="Health" percent={ctx.health} />

      <AlertList items={alerts} />

      <div className="g-actions">
        <ActionButton href="/scout" icon="scout">
          Scout
        </ActionButton>
        <ActionButton href="/produce" icon="produce">
          Produce
        </ActionButton>
        <ActionButton href="/shop" icon="shop" prefetch>
          Shop
        </ActionButton>
        <ActionButton href="/rankings" icon="rankings">
          Rankings
        </ActionButton>
      </div>
    </>
  );
}
