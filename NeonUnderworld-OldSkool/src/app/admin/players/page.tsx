import Link from 'next/link';
import { getAdminPlayersAction } from '@core/server/actions/admin-operations.actions';

export default async function AdminPlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? '1') || 1;
  const sort = (params.sort as 'nw' | 'activity' | 'alias' | undefined) ?? 'activity';

  const data = await getAdminPlayersAction({
    search: params.q,
    sort,
    page,
    activatedOnly: false,
  });

  return (
    <div className="g-admin-stack">
      <section className="g-admin-panel">
        <h2>Players</h2>
        <form className="g-admin-form" method="get">
          <input className="g-input" name="q" placeholder="Search alias" defaultValue={params.q ?? ''} />
          <select className="g-select" name="sort" defaultValue={sort}>
            <option value="activity">Recent activity</option>
            <option value="nw">Net worth</option>
            <option value="alias">Alias</option>
          </select>
          <button className="g-btn g-btn-secondary" type="submit">
            Filter
          </button>
        </form>
        <p className="g-note">{data.total} human accounts · page {data.page}</p>
      </section>

      <section className="g-admin-panel">
        {data.rows.map((row) => (
          <Link key={row.id} href={`/admin/players/${row.id}`} className="g-admin-row">
            <div>
              <strong>{row.alias}</strong>
              <span className="g-admin-row__meta">
                {row.district} · {row.online ? 'Online' : 'Offline'}
                {row.seasonActivatedAt ? '' : ' · Not activated'}
              </span>
            </div>
            <div className="g-admin-row__stats">
              <span>${row.netWorth.toLocaleString()}</span>
              <span>{row.workers}W / {row.thugs}T</span>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
