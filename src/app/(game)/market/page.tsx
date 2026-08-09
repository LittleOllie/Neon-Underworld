import { redirect } from 'next/navigation';
import { GameTopBar } from '@/components/game/GameTopBar';
import { AlphaPreview } from '@/components/game/AlphaPreview';
import { auth } from '@/lib/auth/config';
import { getPlayerState } from '@/server/queries/player.queries';
import { TERMS } from '@/config/game/terminology';

export default async function MarketPage() {
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
        title="Black Market"
        description="Acquire weapons, supplies and assets through the city's underground trade network. The market opens during the alpha."
        previewItems={['Black Market listings', 'City Shop', 'Active bids']}
        primaryAction={{ label: 'Scout the district', href: '/operations/scout' }}
      />
    </>
  );
}
