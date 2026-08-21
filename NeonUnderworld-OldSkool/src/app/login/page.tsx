import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@local/lib/auth/config';
import { LoginForm } from '@local/features/auth/OldSkoolAuth';
import { isGoogleOAuthConfigured } from '@core/lib/auth/google-oauth';
import { redirectIfPlayerMissing, STALE_SESSION_PATH } from '@local/lib/auth/stale-session';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.playerId) {
    try {
      await redirectIfPlayerMissing(session.user.playerId);
    } catch (error) {
      console.error('[login] session validation failed:', error);
      redirect(STALE_SESSION_PATH);
    }
    redirect('/command');
  }

  const googleEnabled = isGoogleOAuthConfigured();

  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
