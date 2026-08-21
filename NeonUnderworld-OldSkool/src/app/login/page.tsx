import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@local/lib/auth/config';
import { LoginForm } from '@local/features/auth/OldSkoolAuth';
import { isGoogleOAuthConfigured } from '@core/lib/auth/google-oauth';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.playerId) {
    redirect('/command');
  }

  const googleEnabled = isGoogleOAuthConfigured();

  return (
    <Suspense fallback={null}>
      <LoginForm googleEnabled={googleEnabled} />
    </Suspense>
  );
}
