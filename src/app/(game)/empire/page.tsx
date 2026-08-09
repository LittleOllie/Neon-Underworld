import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/config';
import { getPlayerState, getRecentActivity, getRecentScouts } from '@/server/queries/player.queries';
import { EmpirePageClient } from '@/features/empire/EmpirePageClient';

export default async function EmpirePage() {
  const session = await auth();
  if (!session?.user?.playerId) redirect('/login');

  const state = await getPlayerState(session.user.playerId);
  if (!state) redirect('/register');

  const activity = await getRecentActivity(state.id);
  const scouts = await getRecentScouts(state.id);

  return <EmpirePageClient state={state} scouts={scouts} activity={activity} />;
}
