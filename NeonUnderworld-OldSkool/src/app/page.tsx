import { redirect } from 'next/navigation';
import { auth } from '@local/lib/auth/config';
import { redirectIfPlayerMissing } from '@local/lib/auth/stale-session';

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.playerId) {
    await redirectIfPlayerMissing(session.user.playerId);
    redirect('/command');
  }
  redirect('/login');
}
