import { SessionProvider } from 'next-auth/react';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { getDistricts } from '@/server/queries/player.queries';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const districts = await getDistricts();

  return (
    <SessionProvider>
      <RegisterForm
        districts={districts.map((d) => ({
          slug: d.slug,
          name: d.name,
          description: d.description,
        }))}
      />
    </SessionProvider>
  );
}
