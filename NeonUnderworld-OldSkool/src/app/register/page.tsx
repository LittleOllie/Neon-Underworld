import { redirect } from 'next/navigation';
import { AuthShell } from '@local/components/game/AuthShell';
import { RegisterForm } from '@local/features/auth/RegisterForm';
import { loadRegisterPageData } from '@local/lib/register-page-data';
import { auth } from '@local/lib/auth/config';
import { isGoogleOAuthConfigured } from '@core/lib/auth/google-oauth';

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.playerId) {
    redirect('/command');
  }

  const data = await loadRegisterPageData();

  if (!data.ok) {
    return (
      <AuthShell title="Register">
        <p className="g-auth-error" role="alert">
          {data.message}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Register">
      <RegisterForm districts={data.districts} googleEnabled={isGoogleOAuthConfigured()} />
    </AuthShell>
  );
}
