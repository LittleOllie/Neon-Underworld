import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAdminPlayerDetailAction } from '@core/server/actions/admin-operations.actions';
import { AdminTurnGrantForm } from '@local/features/admin/AdminTurnGrantForm';

export default async function AdminPlayerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminPlayerDetailAction(id);
  if (!detail) notFound();

  const { player, eventCounts, recentEvents, snapshots, progression, adminLogs, roundHistory } = detail;

  return (
    <div className="g-admin-stack">
      <p>
        <Link href="/admin/players">← Players</Link>
      </p>

      <section className="g-admin-panel">
        <h2>{player.alias}</h2>
        <p className="g-note">
          {player.district.name} · {player.isHuman ? 'Human' : 'NPC'} · {player.lifeStatus}
        </p>
        <div className="g-admin-card-grid">
          <div className="g-admin-card"><p className="g-admin-card__label">Influence</p><p className="g-admin-card__value">${player.netWorth.toLocaleString()}</p></div>
          <div className="g-admin-card"><p className="g-admin-card__label">Cash</p><p className="g-admin-card__value">${player.cash.toLocaleString()}</p></div>
          <div className="g-admin-card"><p className="g-admin-card__label">Bank</p><p className="g-admin-card__value">${player.bankCash.toLocaleString()}</p></div>
          <div className="g-admin-card"><p className="g-admin-card__label">Turns</p><p className="g-admin-card__value">{player.turnState?.currentTurns ?? 0}</p></div>
          <div className="g-admin-card"><p className="g-admin-card__label">Specialists</p><p className="g-admin-card__value">{player.prostitutes}</p></div>
          <div className="g-admin-card"><p className="g-admin-card__label">Enforcers</p><p className="g-admin-card__value">{player.thugs}</p></div>
          <div className="g-admin-card"><p className="g-admin-card__label">Businesses</p><p className="g-admin-card__value">{player.businesses}</p></div>
        </div>
      </section>

      <section className="g-admin-panel">
        <h3>Round progression</h3>
        <p>Activated: {progression.activationDate?.toLocaleString() ?? 'Not yet'}</p>
        <p>Specialist growth: {progression.workerGrowth ?? '—'}</p>
        <p>Enforcer growth: {progression.thugGrowth ?? '—'}</p>
        <p>Influence growth: {progression.nwGrowth?.toLocaleString() ?? '—'}</p>
        <p>Snapshots: {snapshots.length} day(s)</p>
      </section>

      <section className="g-admin-panel">
        <h3>Activity counts</h3>
        <ul className="g-admin-list">
          {Object.entries(eventCounts).map(([type, count]) => (
            <li key={type}>{type}: {count}</li>
          ))}
        </ul>
      </section>

      <AdminTurnGrantForm playerId={player.id} alias={player.alias} />

      <section className="g-admin-panel">
        <h3>Recent gameplay</h3>
        <ul className="g-admin-list">
          {recentEvents.map((e) => (
            <li key={e.id}>{e.createdAt.toLocaleString()} — {e.eventType}</li>
          ))}
        </ul>
      </section>

      <section className="g-admin-panel">
        <h3>Round history</h3>
        <ul className="g-admin-list">
          {roundHistory.map((r) => (
            <li key={r.id}>
              Season archive · Influence {r.finalNetWorth.toLocaleString()} · {r.finalWorkers}S / {r.finalThugs}E
            </li>
          ))}
        </ul>
      </section>

      <section className="g-admin-panel">
        <h3>Admin history</h3>
        <ul className="g-admin-list">
          {adminLogs.map((log) => (
            <li key={log.id}>{log.createdAt.toLocaleString()} — {log.action}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
