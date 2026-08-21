import Link from 'next/link';
import { getAdminRoundsAction } from '@core/server/actions/admin-operations.actions';

export default async function AdminRoundsPage() {
  const rounds = await getAdminRoundsAction();

  return (
    <div className="g-admin-stack">
      <section className="g-admin-panel">
        <h2>Round history</h2>
        <p className="g-note">Historical analytics remain tied to each round.</p>
      </section>

      {rounds.map((round) => (
        <section key={round.id} className="g-admin-panel">
          <h3>
            {round.name} (#{round.number}) — {round.status}
          </h3>
          <p>
            {new Date(round.startsAt).toLocaleDateString()} → {new Date(round.endsAt).toLocaleDateString()}
          </p>
          <Link href={`/admin/analytics?season=${round.id}`}>Open analytics</Link>
        </section>
      ))}
    </div>
  );
}
