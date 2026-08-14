import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageTitle, StatRow } from '@local/components/game';
import { PlayerAvatar } from '@local/components/game/PlayerAvatar';
import { PublicProfileService } from '@local/server/services/public-profile.service';
import { ReportService } from '@local/server/services/report.service';
import { requireGameSession, formatRelativeTime } from '@local/lib/game-context';
import { resolveProfileAttackEligibility, type ProfileAttackEligibility } from '@core/lib/game-engine/combat/eligibility';
import { formatRank } from '@local/lib/format-rank';
import { OS_TERMS } from '@local/config/terminology';
import { PlayerProfilePanel } from '@local/features/player/PlayerProfilePanel';

interface Props {
  params: Promise<{ alias: string }>;
}

export default async function PlayerProfilePage({ params }: Props) {
  const { alias } = await params;
  const { ctx } = await requireGameSession();
  const profile = await PublicProfileService.getByAlias(alias);
  if (!profile) notFound();

  const isSelf = profile.aliasNormalized === ctx.aliasNormalized;
  const intelReport = isSelf
    ? null
    : await ReportService.getIntelReportForTarget(ctx.id, profile.aliasNormalized);
  const deepIntelReport = isSelf
    ? null
    : await ReportService.getDeepIntelReportForTargetAlias(ctx.id, profile.aliasNormalized);

  const existingIntel = intelReport
    ? {
        reportId: intelReport.reportId,
        bands: intelReport.bands,
        expiresAt: intelReport.intel.expiresAt,
      }
    : null;

  const existingDeepIntel = deepIntelReport
    ? {
        reportId: deepIntelReport.reportId,
        estimatedThugMin: deepIntelReport.deepIntel.estimatedThugMin,
        estimatedThugMax: deepIntelReport.deepIntel.estimatedThugMax,
        estimatedWorkerMin: deepIntelReport.deepIntel.estimatedWorkerMin,
        estimatedWorkerMax: deepIntelReport.deepIntel.estimatedWorkerMax,
        weaponReadinessBand: deepIntelReport.deepIntel.weaponReadinessBand,
        cashExposureBand: deepIntelReport.deepIntel.cashExposureBand,
        drugExposureBand: deepIntelReport.deepIntel.drugExposureBand,
        cartelPresence: deepIntelReport.deepIntel.cartelPresence,
        workforceStabilityBand: deepIntelReport.deepIntel.workforceStabilityBand,
        workforceProtectionBand: deepIntelReport.deepIntel.workforceProtectionBand,
        poachingOutlook: deepIntelReport.deepIntel.poachingOutlook,
        gatheredAt: deepIntelReport.deepIntel.scoutedAt,
      }
    : null;

  const attackEligibility: ProfileAttackEligibility = isSelf
    ? { status: 'self' }
    : resolveProfileAttackEligibility({
        viewerId: ctx.id,
        viewerDistrictId: ctx.district.id,
        viewerNw: ctx.netWorth,
        targetPlayerId: profile.id,
        targetDistrictId: profile.districtId,
        targetNw: profile.netWorth,
        targetLifeStatus: profile.lifeStatus,
        targetTravelling: profile.travelling,
      });

  return (
    <>
      <div className="g-profile-header">
        <PlayerAvatar avatarId={profile.avatarId} alt={profile.alias} size="xl" priority />
        <PageTitle icon="player">{profile.alias}</PageTitle>
      </div>

      <StatRow label={OS_TERMS.districtRank} value={formatRank(profile.rank)} />
      <StatRow label={OS_TERMS.netWorth} value={`$${profile.netWorth.toLocaleString()}`} />
      <StatRow label={OS_TERMS.city} value={profile.city} />
      <StatRow
        label={OS_TERMS.lastSeen}
        value={profile.online ? OS_TERMS.online : formatRelativeTime(profile.lastSeen ?? new Date(0))}
      />
      {profile.cartelName && (
        <StatRow
          label={OS_TERMS.cartel}
          value={`[${profile.cartelTag}] ${profile.cartelName}`}
        />
      )}

      {isSelf ? (
        <p className="g-note">This is you.</p>
      ) : (
        <PlayerProfilePanel
          targetAlias={profile.alias}
          targetAliasNormalized={profile.aliasNormalized}
          initialTurns={ctx.turns}
          existingIntel={existingIntel}
          existingDeepIntel={existingDeepIntel}
          sameCity={profile.districtId === ctx.district.id}
          viewerCity={ctx.district.name}
          targetCity={profile.city}
          targetCitySlug={profile.citySlug}
          attackEligibility={attackEligibility}
        />
      )}

      <p className="g-note">
        <Link href="/rankings">Rankings</Link>
      </p>
    </>
  );
}
