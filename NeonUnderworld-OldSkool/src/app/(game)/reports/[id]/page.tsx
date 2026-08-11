import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle, StatRow, Divider, SectionLabel, ActionButton } from '@local/components/game';
import { requireGameSession, formatRelativeTime } from '@local/lib/game-context';
import { ReportService, type CombatReportSnapshot } from '@local/server/services/report.service';
import { ReportReadSync } from '@local/features/reports/ReportReadSync';
import { prisma } from '@core/lib/db/prisma';
import { GAMEPLAY_CONTEXT_MESSAGES } from '@core/lib/game-engine/gameplay-errors';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const { playerId, ctx } = await requireGameSession();

  const report = await ReportService.getById(id, playerId);
  if (!report) notFound();

  const wasUnread = !report.read;
  if (wasUnread) {
    await ReportService.markRead(id, playerId);
    report.read = true;
  }

  const meta = report.metadata as {
    type?: string;
    intel?: { targetAlias?: string; targetCity?: string; targetPlayerId?: string; expiresAt?: string };
    snapshot?: CombatReportSnapshot & { bands?: Record<string, string | number> };
  } | null;

  let canAttackFromHere = false;
  if (meta?.type === 'PLAYER_INTEL' && meta.intel?.targetPlayerId) {
    const target = await prisma.player.findUnique({
      where: { id: meta.intel.targetPlayerId },
      select: { districtId: true },
    });
    canAttackFromHere = target?.districtId === ctx.district.id;
  }

  const combat = meta?.type === 'ATTACK' || meta?.type === 'DEFENCE' ? meta.snapshot : null;
  const intelBands = meta?.type === 'PLAYER_INTEL' ? meta.snapshot?.bands : null;

  return (
    <>
      <ReportReadSync wasUnread={wasUnread} />
      <PageTitle>{report.title}</PageTitle>
      <p className="g-note">{formatRelativeTime(report.createdAt)}</p>

      {combat && (
        <>
          <StatRow label="Attacker" value={combat.attackerAlias ?? '—'} />
          <StatRow label="Target" value={combat.targetAlias ?? '—'} />
          <StatRow label="Outcome" value={combat.outcomeLabel} />
          {combat.cashStolen > 0 && (
            <StatRow label="Cash stolen" value={`$${combat.cashStolen.toLocaleString()}`} />
          )}
          <StatRow label="Your losses" value={String(combat.attackerLosses)} />
          <StatRow label="Enemy losses" value={String(combat.defenderLosses)} />
        </>
      )}

      {meta?.type === 'PLAYER_INTEL' && meta.intel && (
        <>
          <SectionLabel>PLAYER INTEL</SectionLabel>
          <StatRow label="Target" value={meta.intel.targetAlias ?? '—'} />
          {intelBands && (
            <>
              <StatRow label="Intel quality" value={`${intelBands.confidence ?? '—'}%`} />
              <StatRow label="Thugs" value={String(intelBands.thugs ?? '—')} />
              <StatRow label="Weapons" value={String(intelBands.weapons ?? '—')} />
              <StatRow label="Cash" value={String(intelBands.cash ?? '—')} />
              <StatRow label="Drugs" value={String(intelBands.drugs ?? '—')} />
            </>
          )}
          {canAttackFromHere ? (
            <ActionButton href={`/attack?reportId=${id}`} icon="attack" className="g-btn-full">
              Attack Player
            </ActionButton>
          ) : (
            <p className="g-note">{GAMEPLAY_CONTEXT_MESSAGES.targetNoLongerInCity}</p>
          )}
        </>
      )}

      {!combat && meta?.type !== 'PLAYER_INTEL' && (
        <>
          <Divider />
          <p>{report.summary}</p>
          {report.body && <p className="g-note">{report.body}</p>}
        </>
      )}

      <p className="g-note">
        <Link href="/reports">Back to reports</Link>
      </p>
    </>
  );
}
