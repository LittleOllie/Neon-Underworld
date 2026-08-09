import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { getPlayerState } from '@/server/queries/player.queries';
import { ScoutPageClient } from '@/features/scouting/ScoutPageClient';

export default async function ScoutPage() {
  const session = await auth();
  if (!session?.user?.playerId) redirect('/login');

  const state = await getPlayerState(session.user.playerId);
  if (!state) redirect('/register');

  return (
    <ScoutPageClient
      alias={state.alias}
      district={state.district.name}
      districtDescription={state.district.description}
      turns={state.turns}
      prostituteHappiness={state.prostituteHappiness.score}
      seasonLabel={state.seasonDisplay.label}
      seasonDay={state.seasonDisplay.dayLabel}
      seasonRemaining={state.seasonDisplay.remainingLabel}
    />
  );
}
