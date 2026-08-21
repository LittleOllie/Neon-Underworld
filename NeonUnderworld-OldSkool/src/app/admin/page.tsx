import { getAdminOverviewAction } from '@core/server/actions/admin-operations.actions';
import { AdminRoundControls } from '@local/features/admin/AdminRoundControls';
import { AdminBulkTurnGrant } from '@local/features/admin/AdminBulkTurnGrant';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="g-admin-card">
      <p className="g-admin-card__label">{label}</p>
      <p className="g-admin-card__value">{value}</p>
    </div>
  );
}

export default async function AdminOverviewPage() {
  const data = await getAdminOverviewAction();

  if (!data.season) {
    return (
      <section className="g-admin-panel">
        <h2>No active round</h2>
        <p className="g-note">Use Rounds to start the next closed test.</p>
        <AdminRoundControls season={null} />
      </section>
    );
  }

  const { season, humans, gameHealth, npcHealth, schemaReady } = data;

  return (
    <div className="g-admin-stack">
      {!schemaReady && (
        <section className="g-admin-panel">
          <p className="g-note">
            Basic admin is active. Full analytics counters need the local admin migration — event
            counts may show 0 until that is applied.
          </p>
        </section>
      )}
      <section className="g-admin-panel">
        <h2>Current round</h2>
        <div className="g-admin-card-grid">
          <StatCard label="Round" value={`${season.name} (#${season.number})`} />
          <StatCard label="Status" value={season.status} />
          <StatCard label="Calendar" value={season.dayLabel} />
          <StatCard label="Ends" value={new Date(season.endsAt).toLocaleDateString()} />
        </div>
      </section>

      <section className="g-admin-panel">
        <h2>Real human players</h2>
        <div className="g-admin-card-grid">
          <StatCard label="Registered" value={humans.registered} />
          <StatCard label="Activated this round" value={humans.activated} />
          <StatCard label="Active today" value={humans.activeToday} />
          <StatCard label="Active 24h" value={humans.active24h} />
          <StatCard label="Active 7d" value={humans.active7d} />
          <StatCard label="Online now" value={humans.onlineNow} />
          <StatCard label="New activations today" value={humans.newActivationsToday} />
        </div>
      </section>

      <section className="g-admin-panel">
        <h2>Game health</h2>
        <div className="g-admin-card-grid">
          <StatCard label="Median Influence" value={`$${gameHealth.medianHumanNw.toLocaleString()}`} />
          <StatCard label="Highest Influence" value={`$${gameHealth.highestHumanNw.toLocaleString()}`} />
          <StatCard label="Median Specialists" value={gameHealth.medianWorkers} />
          <StatCard label="Median Enforcers" value={gameHealth.medianThugs} />
          <StatCard label="Businesses" value={gameHealth.totalBusinesses} />
          <StatCard label="Scouts today" value={gameHealth.scoutsToday} />
          <StatCard label="Operations today" value={gameHealth.produceToday} />
          <StatCard label="Attacks today" value={gameHealth.attacksToday} />
          <StatCard label="Shop purchases today" value={gameHealth.shopPurchasesToday} />
        </div>
      </section>

      <section className="g-admin-panel">
        <h2>NPC health</h2>
        <div className="g-admin-card-grid">
          <StatCard label="Progression NPCs" value={npcHealth.progressionManagedCount} />
          <StatCard label="Progression day" value={npcHealth.currentProgressionDay} />
          <StatCard label="Stale NPCs" value={npcHealth.staleNpcCount} />
          <StatCard label="District spread" value={npcHealth.districtSpread} />
        </div>
      </section>

      <AdminBulkTurnGrant seasonId={season.id} />
      <AdminRoundControls season={season} />
    </div>
  );
}
