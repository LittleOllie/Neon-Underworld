import {
  PageTitle,
  StatusBar,
  AlertList,
  ActionButton,
  HomeCrewSummary,
  BusinessHeatSummary,
  FirstMoveCard,
  PvpDiscoveryHint,
} from '@local/components/game';
import {
  requireGameSession,
  loadAttentionBundle,
  prioritizeAttentionItems,
} from '@local/lib/game-context';
import { PlayerService } from '@local/server/services/player.service';
import { getOnboardingState } from '@local/lib/onboarding';
import { devPerf } from '@local/lib/dev-perf';
import { isRoutePrefetch } from '@local/lib/is-route-prefetch';
import Link from 'next/link';

export default async function CommandPage() {
  const { playerId, ctx } = await requireGameSession();
  const prefetch = await isRoutePrefetch();

  const { attentionAll, onboarding, businessOperations } = await devPerf('/command attention', async () => {
    const [bundle, onboardingState] = await Promise.all([
      loadAttentionBundle(ctx),
      getOnboardingState(playerId),
      prefetch ? Promise.resolve() : PlayerService.recordLoginIfNeeded(playerId, ctx.alias),
    ]);
    return {
      attentionAll: bundle.items,
      businessOperations: bundle.businessOperations,
      onboarding: onboardingState,
    };
  });

  const { visible: alerts, remaining } = prioritizeAttentionItems(attentionAll, 5);
  const showOnboarding = onboarding.phase !== 'none';

  return (
    <>
      <PageTitle icon="home">Home</PageTitle>

      {showOnboarding ? (
        <FirstMoveCard variant={onboarding.phase === 'first-move' ? 'first-move' : 'next-move'} />
      ) : null}

      {!showOnboarding ? (
        <HomeCrewSummary
          workers={ctx.prostitutes}
          thugs={ctx.thugs}
          workerHappiness={ctx.prostituteHappiness.score}
          thugHappiness={ctx.thugHappiness.score}
        />
      ) : null}

      {!showOnboarding && businessOperations ? (
        <BusinessHeatSummary operations={businessOperations} variant="home" />
      ) : null}

      {!showOnboarding ? <StatusBar label="Health" percent={ctx.health} /> : null}

      {!showOnboarding ? (
        <>
          <AlertList items={alerts} />
          {remaining > 0 ? (
            <p className="g-note g-attention-more">
              <Link href="/reports?filter=unread">View all reports</Link>
              {' · '}
              {remaining} more alert{remaining === 1 ? '' : 's'}
            </p>
          ) : null}
          <PvpDiscoveryHint />
        </>
      ) : null}

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
