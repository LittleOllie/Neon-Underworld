import { PublicHomeLayout, LoginForm } from '@local/features/auth/OldSkoolAuth';
import { loadPublicPageData } from '@local/lib/public-page-data';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const data = await loadPublicPageData();

  if (!data.ok) {
    return (
      <PublicHomeLayout leaders={[]} seasonLabel="Neon Underworld">
        <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--os-gold)' }}>Welcome to Neon Underworld</h2>
        <p role="alert" style={{ color: 'var(--os-red)', lineHeight: 1.5 }}>
          {data.message}
        </p>
      </PublicHomeLayout>
    );
  }

  return (
    <PublicHomeLayout leaders={data.leaders} seasonLabel={data.seasonLabel}>
      <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--os-gold)' }}>Welcome to Neon Underworld</h2>
      <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
        OldSkool Edition — a turn-based district strategy game. Scout your territory, build your empire,
        and climb the rankings. Same world as the modern client. Same database. Different interface.
      </p>
      <LoginForm />
    </PublicHomeLayout>
  );
}
