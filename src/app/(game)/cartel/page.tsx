import { auth } from '@/lib/auth/config';
import { GameTopBar } from '@/components/game/GameTopBar';
import { AlphaPreview } from '@/components/game/AlphaPreview';
import { getPlayerState } from '@/server/queries/player.queries';
import { TERMS } from '@/config/game/terminology';

export default async function CartelPage() {
  const session = await auth();
  const state = session?.user?.playerId ? await getPlayerState(session.user.playerId) : null;

  return (
    <>
      {state && (
        <GameTopBar
          alias={state.alias}
          district={state.district.name}
          seasonLabel={state.seasonDisplay.label}
          seasonDay={state.seasonDisplay.dayLabel}
          seasonRemaining={state.seasonDisplay.remainingLabel}
        />
      )}
      <AlphaPreview
        title={TERMS.cartel}
        description="Form a five-player Cartel to pool resources, coordinate strategy and compete for seasonal dominance. Cartels arrive in a future alpha release."
        previewItems={['Members', 'War Chest', 'Contribution rate', 'Cartel rankings']}
        primaryAction={{ label: 'Return to Command', href: '/command' }}
      />
    </>
  );
}
