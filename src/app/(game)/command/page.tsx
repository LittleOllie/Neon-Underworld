import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { CommandCentre } from '@/features/command/CommandCentre';
import { buildCityFeed } from '@/features/command/city-feed';
import { getCommandPresentation } from '@/features/command/recommendations';
import { getPlayerState, getCityIntelligence } from '@/server/queries/player.queries';

export default async function CommandPage() {
  const session = await auth();
  if (!session?.user?.playerId) redirect('/register');

  const state = await getPlayerState(session.user.playerId);
  if (!state) redirect('/register');

  const intelligence = await getCityIntelligence(state.season.id);
  const presentation = getCommandPresentation(state);

  const cityFeed = buildCityFeed({
    topPlayer: intelligence.topPlayer
      ? { alias: intelligence.topPlayer.alias }
      : null,
    largestMovement: intelligence.largestMovement.alias
      ? intelligence.largestMovement
      : null,
    topDistrict: intelligence.topDistrict.name ? intelligence.topDistrict : null,
    latestEvent: intelligence.latestEvent,
  });

  return (
    <CommandCentre
      alias={state.alias}
      district={state.district.name}
      seasonDay={state.seasonDisplay.dayLabel}
      seasonLabel={state.seasonDisplay.label}
      turns={state.turns}
      turnCap={state.turnCap}
      isAtCap={state.isAtCap}
      msUntilNextTurn={state.msUntilNextTurn}
      cash={state.cash}
      rank={state.rank}
      netWorth={state.netWorth}
      presentation={presentation}
      cityFeed={cityFeed}
    />
  );
}
