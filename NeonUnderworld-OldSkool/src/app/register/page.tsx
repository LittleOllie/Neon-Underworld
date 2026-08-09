import { AuthShell } from '@local/components/game/AuthShell';
import { RegisterForm } from '@local/features/auth/RegisterForm';
import { loadRegisterPageData } from '@local/lib/register-page-data';

export default async function RegisterPage() {
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
      <RegisterForm districts={data.districts} />
    </AuthShell>
  );
}
