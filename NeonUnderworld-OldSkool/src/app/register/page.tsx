import { getDistricts, getActiveSeason, getRankings } from '@core/server/queries/player.queries';
import { PublicHomeLayout } from '@local/features/auth/OldSkoolAuth';
import { RegisterForm } from '@local/features/auth/RegisterForm';

export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const districts = await getDistricts();
  const season = await getActiveSeason();
  const leaders = season ? (await getRankings(season.id, 1, 5)).items : [];

  return (
    <>
      <PublicHomeLayout
        leaders={leaders.map((l) => ({ rank: l.rank, alias: l.alias, netWorth: l.netWorth }))}
        seasonLabel={season ? `Season ${season.number}` : 'No active season'}
      >
        <RegisterForm districts={districts.map((d) => ({ slug: d.slug, name: d.name, description: d.description }))} />
      </PublicHomeLayout>
    </>
  );
}
