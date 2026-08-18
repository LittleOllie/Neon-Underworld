import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { auth } from '@local/lib/auth/config';
import { LoginForm } from '@local/features/auth/OldSkoolAuth';

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.playerId) {
    redirect('/command');
  }

  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
