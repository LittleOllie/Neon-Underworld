import { SessionProvider } from 'next-auth/react';
import { getActiveSeason, getRankings } from '@core/server/queries/player.queries';
import { PublicHomeLayout, LoginForm } from '@local/features/auth/OldSkoolAuth';

export default async function LoginPage() {
  const season = await getActiveSeason();
  const leaders = season ? (await getRankings(season.id, 1, 5)).items : [];

  return (
    <>
      <PublicHomeLayout
        leaders={leaders.map((l) => ({ rank: l.rank, alias: l.alias, netWorth: l.netWorth }))}
        seasonLabel={season ? `Season ${season.number}` : 'No active season'}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--os-gold)' }}>Welcome to Neon Underworld</h2>
        <p style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          OldSkool Edition — a turn-based district strategy game. Scout your territory, build your empire,
          and climb the rankings. Same world as the modern client. Same database. Different interface.
        </p>
        <LoginForm />
      </PublicHomeLayout>
    </>
  );
}
