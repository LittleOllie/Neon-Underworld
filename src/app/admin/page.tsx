import { redirect } from 'next/navigation';
import { getAdminDashboardData } from '@/server/actions/admin.actions';
import { calculateNetWorth } from '@/lib/game-engine/net-worth';
import { playerToResources } from '@/lib/game-engine/state';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AdminInviteForm } from '@/features/admin/AdminInviteForm';

export default async function AdminPage() {
  let data;
  try {
    data = await getAdminDashboardData();
  } catch {
    redirect('/command');
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div>
        <span className="font-display text-sm tracking-widest text-gold">NU ADMIN</span>
        <h1 className="mt-1 font-display text-2xl">Command Dashboard</h1>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4">
        <SectionHeader title="Invite codes" />
        <AdminInviteForm />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2">Label</th>
                <th className="py-2">Uses</th>
                <th className="py-2">Active</th>
              </tr>
            </thead>
            <tbody>
              {data.invites.map((inv) => (
                <tr key={inv.id} className="border-t border-border-subtle">
                  <td className="py-2">{inv.label ?? '—'}</td>
                  <td className="py-2">
                    {inv.currentUses}/{inv.maximumUses}
                  </td>
                  <td className="py-2">{inv.active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <SectionHeader title="Players" subtitle={`${data.players.length} shown`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-2">Alias</th>
                <th className="py-2">District</th>
                <th className="py-2">Turns</th>
                <th className="py-2">NW</th>
                <th className="py-2">System</th>
              </tr>
            </thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.id} className="border-t border-border-subtle">
                  <td className="py-2">{p.alias}</td>
                  <td className="py-2">{p.district.name}</td>
                  <td className="py-2">{p.turnState?.currentTurns ?? 0}</td>
                  <td className="py-2 font-mono-figures">
                    ${calculateNetWorth(playerToResources(p)).toLocaleString()}
                  </td>
                  <td className="py-2">{p.isSystemPlayer ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <SectionHeader title="Recent audit log" />
        <div className="max-h-64 overflow-y-auto text-sm">
          {data.auditLogs.map((log) => (
            <div key={log.id} className="border-b border-border-subtle py-2">
              <span className="text-muted">{new Date(log.createdAt).toLocaleString()}</span>
              {' · '}
              {log.eventType} ({log.source})
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <SectionHeader title="Recent scouts" />
        <div className="text-sm">
          {data.scoutResults.map((s) => (
            <div key={s.id} className="border-b border-border-subtle py-2">
              {s.player.alias}: {s.turnsSpent} turns → +{s.prostitutesFound}p +{s.thugsFound}t
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
