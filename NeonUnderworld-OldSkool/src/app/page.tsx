import { redirect } from 'next/navigation';
import { auth } from '@local/lib/auth/config';
import { redirectIfPlayerMissing, STALE_SESSION_PATH } from '@local/lib/auth/stale-session';

export default async function HomePage() {
  const session = await auth();
  if (session?.user?.playerId) {
    try {
      await redirectIfPlayerMissing(session.user.playerId);
    } catch (error) {
      console.error('[home] session validation failed:', error);
      redirect(STALE_SESSION_PATH);
    }
    redirect('/command');
  }
  redirect('/login');
}
