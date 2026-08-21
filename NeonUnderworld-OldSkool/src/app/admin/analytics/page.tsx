import Link from 'next/link';
import { getAdminAnalyticsAction } from '@core/server/actions/admin-operations.actions';

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const params = await searchParams;
  const data = await getAdminAnalyticsAction(params.season);

  if (!data) {
    return (
      <section className="g-admin-panel">
        <h2>Analytics</h2>
        <p className="g-note">No season data available.</p>
      </section>
    );
  }

  return (
    <div className="g-admin-stack">
      <section className="g-admin-panel">
        <h2>Round analytics — {data.season.name}</h2>
        <p className="g-note">Activated players: {data.activatedPlayers} · Session starts: {data.sessionStarts}</p>
      </section>

      <section className="g-admin-panel">
        <h3>Events by type</h3>
        <ul className="g-admin-list">
          {Object.entries(data.eventsByType).map(([type, count]) => (
            <li key={type}>{type}: {count}</li>
          ))}
        </ul>
      </section>

      <section className="g-admin-panel">
        <h3>Median Influence by round day</h3>
        <ul className="g-admin-list">
          {data.medianNwByDay.map((row) => (
            <li key={row.roundDay}>
              Day {row.roundDay}: ${row.medianNw.toLocaleString()} (n={row.sampleSize})
            </li>
          ))}
        </ul>
      </section>

      <p>
        <Link href="/admin/rounds">View round history →</Link>
      </p>
    </div>
  );
}
