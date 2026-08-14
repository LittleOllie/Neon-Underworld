import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle, StatRow, Divider, SectionLabel, ActionButton } from '@local/components/game';
import { requireGameSession, formatRelativeTime } from '@local/lib/game-context';
import { ReportService, type CombatReportSnapshot } from '@local/server/services/report.service';
import { ReportReadSync } from '@local/features/reports/ReportReadSync';
import { PlayerIdentity } from '@local/components/game/PlayerIdentity';
import { prisma } from '@core/lib/db/prisma';
import { resolvePlayerAvatarId } from '@core/lib/game-engine/resolve-player-avatar';
import { GAMEPLAY_CONTEXT_MESSAGES } from '@core/lib/game-engine/gameplay-errors';
import { formatCountEstimateRange } from '@core/lib/game-engine/combat/deep-intel';
import type { DeepIntelSnapshot } from '@core/lib/game-engine/combat/deep-intel';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const { playerId, ctx } = await requireGameSession();

  const report = await ReportService.getById(id, playerId);
  if (!report) notFound();

  const wasUnread = !report.read;
  let unreadAfterRead: number | undefined;
  if (wasUnread) {
    unreadAfterRead = (await ReportService.markRead(id, playerId)) ?? undefined;
    report.read = true;
  }

  const meta = report.metadata as {
    type?: string;
    intel?: { targetAlias?: string; targetCity?: string; targetPlayerId?: string; expiresAt?: string };
    deepIntel?: DeepIntelSnapshot;
    snapshot?: CombatReportSnapshot & { bands?: Record<string, string | number> };
  } | null;

  let canAttackFromHere = false;
  const intelTargetId = meta?.intel?.targetPlayerId ?? meta?.deepIntel?.targetPlayerId;
  if ((meta?.type === 'PLAYER_INTEL' || meta?.type === 'DEEP_INTEL') && intelTargetId) {
    const target = await prisma.player.findUnique({
      where: { id: intelTargetId },
      select: { districtId: true },
    });
    canAttackFromHere = target?.districtId === ctx.district.id;
  }

  const combat = meta?.type === 'ATTACK' || meta?.type === 'DEFENCE' ? meta.snapshot : null;
  const intelBands = meta?.type === 'PLAYER_INTEL' ? meta.snapshot?.bands : null;
  const deepIntel = meta?.type === 'DEEP_INTEL' ? meta.deepIntel : null;
  const basicIntelReportId =
    meta?.type === 'DEEP_INTEL' && deepIntel
      ? (
          await ReportService.getIntelReportForTarget(playerId, deepIntel.targetAlias)
        )?.reportId
      : meta?.type === 'PLAYER_INTEL'
        ? id
        : null;

  const combatAliases = [combat?.attackerAlias, combat?.targetAlias].filter(
    (alias): alias is string => !!alias,
  );
  const intelAlias =
    meta?.intel?.targetAlias ?? meta?.deepIntel?.targetAlias ?? null;
  const lookupAliases = [...new Set([...combatAliases, intelAlias].filter(Boolean))] as string[];

  const avatarByAlias = new Map<string, string>();
  const normalizedByAlias = new Map<string, string>();
  if (lookupAliases.length > 0) {
    const players = await prisma.player.findMany({
      where: { alias: { in: lookupAliases } },
      select: { alias: true, aliasNormalized: true, avatar: true },
    });
    for (const player of players) {
      avatarByAlias.set(player.alias, resolvePlayerAvatarId(player.avatar));
      normalizedByAlias.set(player.alias, player.aliasNormalized);
    }
  }

  function combatIdentityProps(alias: string) {
    const aliasNormalized = normalizedByAlias.get(alias);
    const isSelf = aliasNormalized === ctx.aliasNormalized;
    return {
      player: {
        alias,
        avatarId: avatarByAlias.get(alias),
        aliasNormalized,
      },
      static: isSelf || !aliasNormalized,
    } as const;
  }

  return (
    <>
      <ReportReadSync unreadReports={unreadAfterRead} reportId={wasUnread ? id : undefined} />
      <PageTitle>{report.title}</PageTitle>
      <p className="g-note">{formatRelativeTime(report.createdAt)}</p>

      {combat && (
        <>
          {combat.attackerAlias && (
            <div className="g-report-identity-row">
              <span className="g-stat-label">Attacker</span>
              <PlayerIdentity
                {...combatIdentityProps(combat.attackerAlias)}
                avatarSize="sm"
              />
            </div>
          )}
          {combat.targetAlias && (
            <div className="g-report-identity-row">
              <span className="g-stat-label">Target</span>
              <PlayerIdentity
                {...combatIdentityProps(combat.targetAlias)}
                avatarSize="sm"
              />
            </div>
          )}
          <StatRow label="Outcome" value={combat.outcomeLabel} />
          {combat.cashStolen > 0 && (
            <StatRow label="Cash stolen" value={`$${combat.cashStolen.toLocaleString()}`} />
          )}
          {combat.workersStolen > 0 && (
            <StatRow label="Workers poached" value={String(combat.workersStolen)} />
          )}
          <StatRow label="Your losses" value={String(combat.attackerLosses)} />
          <StatRow label="Enemy losses" value={String(combat.defenderLosses)} />
          {combat.cartelParticipated && (
            <>
              <SectionLabel>CARTEL DEFENCE</SectionLabel>
              {combat.cartelLocalSupport != null && combat.cartelLocalSupport > 0 && (
                <StatRow
                  label="Local cartel backup"
                  value={`${combat.cartelLocalSupport.toLocaleString()} thugs`}
                />
              )}
              {combat.cartelResponseDeployed != null && combat.cartelResponseDeployed > 0 && (
                <StatRow
                  label="Cartel response deployed"
                  value={`${combat.cartelResponseDeployed.toLocaleString()} thugs`}
                />
              )}
              {combat.cartelResponseLosses != null && combat.cartelResponseLosses > 0 && (
                <StatRow
                  label="Cartel thugs lost"
                  value={String(combat.cartelResponseLosses)}
                />
              )}
            </>
          )}
        </>
      )}

      {meta?.type === 'PLAYER_INTEL' && meta.intel && (
        <>
          <SectionLabel>PLAYER INTEL</SectionLabel>
          {meta.intel.targetAlias && (
            <PlayerIdentity
              player={{
                alias: meta.intel.targetAlias,
                avatarId: avatarByAlias.get(meta.intel.targetAlias),
              }}
              avatarSize="md"
              static
            />
          )}
          {intelBands && (
            <>
              <StatRow label="Intel quality" value={`${intelBands.confidence ?? '—'}%`} />
              <StatRow label="Thug presence" value={String(intelBands.thugs ?? '—')} />
              <StatRow label="Weapons" value={String(intelBands.weapons ?? '—')} />
              <StatRow label="Cash exposure" value={String(intelBands.cash ?? '—')} />
              <StatRow label="Drug exposure" value={String(intelBands.drugs ?? '—')} />
            </>
          )}
          {canAttackFromHere && basicIntelReportId ? (
            <ActionButton href={`/attack?reportId=${basicIntelReportId}`} icon="attack" className="g-btn-full">
              Attack Player
            </ActionButton>
          ) : !canAttackFromHere ? (
            <p className="g-note">{GAMEPLAY_CONTEXT_MESSAGES.targetNoLongerInCity}</p>
          ) : (
            <>
              <SectionLabel>BASIC INTEL REQUIRED</SectionLabel>
              <p className="g-note">Gather fresh Basic Intel before launching an attack.</p>
            </>
          )}
        </>
      )}

      {deepIntel && (
        <>
          <SectionLabel>DEEP INTEL</SectionLabel>
          <StatRow label="Target" value={deepIntel.targetAlias} />
          <StatRow label="City" value={deepIntel.targetCity} />
          <StatRow
            label="Estimated Thugs"
            value={formatCountEstimateRange(deepIntel.estimatedThugMin, deepIntel.estimatedThugMax)}
          />
          <StatRow
            label="Estimated Workers"
            value={formatCountEstimateRange(deepIntel.estimatedWorkerMin, deepIntel.estimatedWorkerMax)}
          />
          <StatRow label="Weapon Readiness" value={deepIntel.weaponReadinessBand} />
          <StatRow label="Workforce Stability" value={deepIntel.workforceStabilityBand} />
          <StatRow label="Protection" value={deepIntel.workforceProtectionBand} />
          <StatRow label="Poaching Outlook" value={deepIntel.poachingOutlook} />
          <StatRow label="Cash Exposure" value={deepIntel.cashExposureBand} />
          <StatRow label="Drug Exposure" value={deepIntel.drugExposureBand} />
          {deepIntel.cartelPresence && (
            <StatRow label="Cartel" value={deepIntel.cartelPresence} />
          )}
          <StatRow label="Intel gathered" value={formatRelativeTime(new Date(deepIntel.scoutedAt))} />
          {canAttackFromHere && basicIntelReportId ? (
            <ActionButton href={`/attack?reportId=${basicIntelReportId}`} icon="attack" className="g-btn-full">
              Attack Player
            </ActionButton>
          ) : !canAttackFromHere ? (
            <p className="g-note">{GAMEPLAY_CONTEXT_MESSAGES.targetNoLongerInCity}</p>
          ) : (
            <>
              <SectionLabel>BASIC INTEL REQUIRED</SectionLabel>
              <p className="g-note">Gather fresh Basic Intel before launching an attack.</p>
            </>
          )}
        </>
      )}

      {!combat && meta?.type !== 'PLAYER_INTEL' && meta?.type !== 'DEEP_INTEL' && (
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
