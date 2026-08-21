'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { useMutationLock } from '@local/hooks/useMutationLock';
import { useOptionalPlayerShell } from '@local/components/game/PlayerShellProvider';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import {
  ATTACK_RULES,
  ATTACK_TYPE_LABELS,
  type AttackType,
} from '@core/config/game/attack-rules';
import { buildCombatResultPresentation } from '@core/lib/game-engine/combat/attack-result-presentation';
import {
  attackTypeDescription,
  formatAttackTurnCostDisplay,
  formatAttackTypeOptionLabel,
  formatInsufficientTurnsForAttack,
  formatTurnCount,
} from '@core/lib/game-engine/combat/attack-presentation';
import {
  maxCommitmentForAttack,
  suggestedCommitmentForAttack,
} from '@core/lib/game-engine/combat/commitment';
import { ridesRequiredForThugs } from '@core/lib/game-engine/combat-rules';
import {
  allocateWeaponsForThugs,
  weaponCoverageBand,
} from '@core/lib/game-engine/combat/weapon-allocation';
import { forceEstimate } from '@core/lib/game-engine/combat/force-score';
import {
  thugBand,
  weaponStrengthBand,
  exposureBand,
  cartelProtectionBand,
  computeConfidencePercent,
} from '@core/lib/game-engine/combat/intel-bands';
import {
  launchAttackAction,
  type OldSkoolAttackLaunchResult,
} from '@local/server/actions/attack.actions';
import { scoutTargetAction } from '@local/server/actions/scout-target.actions';
import { deepIntelTargetAction } from '@local/server/actions/deep-intel-target.actions';
import { formatCountEstimateRange } from '@core/lib/game-engine/combat/deep-intel';
import { workforceStabilityHint } from '@core/lib/game-engine/combat/intel-bands';
import { poachingOutlookHint } from '@core/lib/game-engine/combat/poach-outlook';
import { WORKER_POACHING_RULES } from '@core/config/game/worker-poaching-rules';
import { GAMEPLAY_CONTEXT_MESSAGES } from '@core/lib/game-engine/gameplay-errors';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { OptionGrid } from '@local/components/game/OptionGrid';
import { SelectableCard } from '@local/components/game/SelectableCard';
import { StatusBadge } from '@local/components/game/StatusBadge';
import { CombatResultPanel } from '@local/components/game/CombatResultPanel';
import { StatRow } from '@local/components/game/StatRow';
import { PlayerIdentity } from '@local/components/game/PlayerIdentity';
import { Divider } from '@local/components/game/Divider';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { formatRank } from '@local/lib/format-rank';
import { OS_TERMS } from '@local/config/terminology';
import type { AttackTargetCandidate, DeepIntelDisplay } from './AttackForm.types';

interface AttackFormProps {
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  turns: number;
  targets: AttackTargetCandidate[];
  initialTargetAlias?: string;
  initialReportId?: string;
  staleIntelNotice?: string | null;
  requestedTargetNotice?: { heading: string | null; message: string } | null;
  attackRangeMinNetWorth?: number;
  attackRangeMaxNetWorth?: number;
  intelTurnCost: number;
  deepIntelTurnCost: number;
  viewerCity: string;
}

function formatIntelAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

const ATTACK_TYPES: AttackType[] = ['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS', 'POACH_WORKERS'];

function thugForceMultiplier(label: string): number {
  if (label === 'Massive') return 800;
  if (label === 'Very High') return 400;
  if (label === 'High') return 150;
  if (label === 'Moderate') return 60;
  if (label === 'Low') return 20;
  if (label === 'Very Low') return 8;
  return 20;
}

function riskFromForce(estimate: string): string {
  if (estimate === 'Unknown') return 'Unknown';
  if (estimate === 'Overwhelming Advantage' || estimate === 'Advantage') return 'Moderate';
  if (estimate === 'Even Match') return 'High';
  return 'Severe';
}

function formatOwnedWeapons(aks: number, uzis: number, glocks: number): string {
  const parts = [
    aks > 0 ? `${aks.toLocaleString()} ${OS_TERMS.ak}` : null,
    uzis > 0 ? `${uzis.toLocaleString()} ${OS_TERMS.uzi}` : null,
    glocks > 0 ? `${glocks.toLocaleString()} ${OS_TERMS.glock}` : null,
  ].filter((part): part is string => part != null);

  return parts.length > 0 ? parts.join(' · ') : 'None';
}

function displayFactionPresence(label: string): string {
  return label
    .replace(/\bCartel\b/g, OS_TERMS.faction)
    .replace(/\bcartel\b/g, OS_TERMS.faction.toLowerCase());
}

function themeAttackIntelHint(text: string): string {
  return text
    .replace(/\bWorkers\b/g, OS_TERMS.specialists)
    .replace(/\bworkers\b/g, OS_TERMS.specialists.toLowerCase())
    .replace(/\bPoaching\b/g, 'Extraction')
    .replace(/\bpoaching\b/g, 'extraction')
    .replace(/\bpoachable\b/gi, 'extractable');
}

function AttackCrewSummary({
  thugs,
  rides,
  glocks,
  uzis,
  aks,
  force,
  weaponAlloc,
}: {
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  force: number;
  weaponAlloc: ReturnType<typeof allocateWeaponsForThugs>;
}) {
  return (
    <>
      <SectionLabel>YOUR CREW</SectionLabel>
      <StatRow label={`${OS_TERMS.enforcers} available`} value={thugs.toLocaleString()} />
      <StatRow label="Rides" value={rides.toLocaleString()} />
      <StatRow label="Weapons owned" value={formatOwnedWeapons(aks, uzis, glocks)} />
      {force > 0 && (
        <>
          <p className="g-note">
            Sending {force.toLocaleString()} {OS_TERMS.enforcers.toLowerCase()} — strongest weapons
            assigned first ({OS_TERMS.ak} → {OS_TERMS.uzi} → {OS_TERMS.glock}).
          </p>
          {weaponAlloc.aks > 0 && (
            <StatRow label={`${OS_TERMS.ak} armed`} value={weaponAlloc.aks.toLocaleString()} />
          )}
          {weaponAlloc.uzis > 0 && (
            <StatRow label={`${OS_TERMS.uzi} armed`} value={weaponAlloc.uzis.toLocaleString()} />
          )}
          {weaponAlloc.glocks > 0 && (
            <StatRow
              label={`${OS_TERMS.glock} armed`}
              value={weaponAlloc.glocks.toLocaleString()}
            />
          )}
          {weaponAlloc.unarmedThugs > 0 && (
            <StatRow label="Unarmed" value={weaponAlloc.unarmedThugs.toLocaleString()} />
          )}
        </>
      )}
      <Divider />
    </>
  );
}

function bandsFromIntel(intel: {
  estimatedThugs: number;
  estimatedWeaponStrength: number;
  estimatedCash: number;
  estimatedDrugs: number;
  cartelId: string | null;
  scoutedAt: string;
  expiresAt: string;
}) {
  return {
    thugs: thugBand(intel.estimatedThugs),
    weapons: weaponStrengthBand(intel.estimatedWeaponStrength, intel.estimatedThugs),
    cash: exposureBand(intel.estimatedCash),
    drugs: exposureBand(intel.estimatedDrugs * 5),
    cartel: cartelProtectionBand(intel.cartelId, ATTACK_RULES.cartelDefenceActive),
    confidence: computeConfidencePercent(new Date(intel.scoutedAt), new Date(intel.expiresAt)),
  };
}

function resolveInitialTarget(
  targets: AttackTargetCandidate[],
  initialTargetAlias?: string,
  initialReportId?: string,
): AttackTargetCandidate | null {
  if (initialReportId) {
    const byReport = targets.find((t) => t.reportId === initialReportId);
    if (byReport) return byReport;
  }
  if (initialTargetAlias) {
    const byAlias = targets.find((t) => t.aliasNormalized === initialTargetAlias);
    if (byAlias) return byAlias;
  }
  return null;
}

function TargetCard({
  target,
  onSelect,
}: {
  target: AttackTargetCandidate;
  onSelect: () => void;
}) {
  return (
    <SelectableCard as="div" className="g-attack-target-card" title={target.alias}>
      <PlayerIdentity
        player={{
          alias: target.alias,
          ...target.identity,
          aliasNormalized: target.aliasNormalized,
          rank: target.rank,
          netWorth: target.netWorth,
        }}
        avatarSize="rank"
        shape="square"
        showRank
        static
      />
      {(target.hasIntel || !target.eligible) && (
        <div className="g-filter-row">
          {target.hasIntel ? <StatusBadge>Intel available</StatusBadge> : null}
          {!target.eligible ? (
            <StatusBadge tone="muted">{target.eligibilityNote}</StatusBadge>
          ) : null}
        </div>
      )}
      <StatRow label="Status" value={target.statusLabel} />
      <PrimaryButton className="g-btn-full g-btn-secondary" variant="secondary" onClick={onSelect}>
        {target.hasIntel ? 'View Intel / Attack' : 'Select Target'}
      </PrimaryButton>
    </SelectableCard>
  );
}

export function AttackForm(props: AttackFormProps) {
  const router = useRouter();
  const reconcile = useGameplayReconcile();
  const { locked: formLocked, pendingKey, run } = useMutationLock();
  const shellCtx = useOptionalPlayerShell();
  const [targets, setTargets] = useState(props.targets);
  const [turns, setTurns] = useState(props.turns);
  const [crew, setCrew] = useState({
    thugs: props.thugs,
    rides: props.rides,
    glocks: props.glocks,
    uzis: props.uzis,
    aks: props.aks,
  });
  const [selected, setSelected] = useState<AttackTargetCandidate | null>(() =>
    resolveInitialTarget(props.targets, props.initialTargetAlias, props.initialReportId),
  );
  const [showIntel, setShowIntel] = useState(false);
  const [showDeepIntel, setShowDeepIntel] = useState(false);

  const [attackType, setAttackType] = useState<AttackType>('HOME_INVASION');
  const forceMax = useMemo(
    () => maxCommitmentForAttack(attackType, crew.thugs),
    [attackType, crew.thugs],
  );
  const defaultForce = useMemo(
    () => suggestedCommitmentForAttack(attackType, crew.thugs),
    [attackType, crew.thugs],
  );
  const [forceRaw, setForceRaw] = useState(String(defaultForce));
  const [force, setForce] = useState(defaultForce);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OldSkoolAttackLaunchResult | null>(null);

  useEffect(() => {
    const next = suggestedCommitmentForAttack(attackType, crew.thugs);
    setForce(next);
    setForceRaw(String(next));
  }, [attackType, crew.thugs]);

  useEffect(() => {
    setTargets(props.targets);
    setTurns(props.turns);
    setCrew({
      thugs: shellCtx?.stats.thugs ?? props.thugs,
      rides: props.rides,
      glocks: props.glocks,
      uzis: props.uzis,
      aks: props.aks,
    });
  }, [props.targets, props.turns, props.thugs, props.rides, props.glocks, props.uzis, props.aks, shellCtx?.stats.thugs]);

  function applyAttackShell(shell: PlayerShellSnapshot) {
    reconcile(shell);
    setCrew((prev) => ({
      thugs: shell.thugs ?? prev.thugs,
      rides: shell.rides ?? prev.rides,
      glocks: shell.glocks ?? prev.glocks,
      uzis: shell.uzis ?? prev.uzis,
      aks: shell.aks ?? prev.aks,
    }));
  }

  useEffect(() => {
    if (!props.initialTargetAlias && !props.initialReportId) return;
    const next = resolveInitialTarget(
      props.targets,
      props.initialTargetAlias,
      props.initialReportId,
    );
    setSelected(next);
    setShowIntel(!!next?.hasIntel);
    setConfirming(false);
    setError('');
  }, [props.initialTargetAlias, props.initialReportId, props.targets]);

  const ridesNeeded = useMemo(
    () => ridesRequiredForThugs(force, ATTACK_RULES.thugsPerRide),
    [force],
  );

  const weaponAlloc = useMemo(
    () =>
      allocateWeaponsForThugs(force, {
        glocks: crew.glocks,
        uzis: crew.uzis,
        aks: crew.aks,
      }),
    [force, crew.glocks, crew.uzis, crew.aks],
  );

  const turnCost = ATTACK_RULES.turnCosts[attackType];
  const weaponPct = force <= 0 ? 0 : Math.round((weaponAlloc.armedThugs / force) * 100);

  const forceEstimateLabel = useMemo(() => {
    if (!selected?.bands) return 'Unknown';
    const defenderStrength =
      selected.bands.weapons === 'Heavily Armed'
        ? 500
        : selected.bands.weapons === 'Armed'
          ? 150
          : 40;
    const thugMult = thugForceMultiplier(selected.bands.thugs);
    return forceEstimate(weaponAlloc.totalStrength, defenderStrength + thugMult);
  }, [selected, weaponAlloc.totalStrength]);

  const usingStaleReport =
    !!props.staleIntelNotice &&
    !!props.initialReportId &&
    selected?.reportId === props.initialReportId;

  const poachBlockedByDeepIntel =
    attackType === 'POACH_WORKERS' &&
    !!selected?.deepIntel &&
    selected.deepIntel.estimatedWorkerMax < WORKER_POACHING_RULES.minWorkersToPoach;

  const canAttack =
    selected?.eligible &&
    selected.reportId &&
    !usingStaleReport &&
    !poachBlockedByDeepIntel &&
    force > 0 &&
    force <= crew.thugs &&
    force <= forceMax &&
    ridesNeeded <= crew.rides &&
    turnCost <= turns;

  async function handleGatherIntel() {
    if (!selected) return;
    await run('intel', async () => {
      setError('');
      const response = await scoutTargetAction(selected.alias, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setTurns(response.data.newTurns);
      const bands = bandsFromIntel(response.data.intel);
      const updated: AttackTargetCandidate = {
        ...selected,
        hasIntel: true,
        reportId: response.data.reportId,
        bands,
      };
      setSelected(updated);
      setTargets((prev) =>
        prev.map((t) => (t.playerId === updated.playerId ? updated : t)),
      );
      setShowIntel(true);
      reconcile(response.data.shell);
    });
  }

  async function handleGatherDeepIntel(refresh = false) {
    if (!selected) return;
    await run('deep-intel', async () => {
      setError('');
      const response = await deepIntelTargetAction(selected.alias, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setTurns(response.data.newTurns);
      const deepIntel: DeepIntelDisplay = {
        reportId: response.data.reportId,
        estimatedThugMin: response.data.deepIntel.estimatedThugMin,
        estimatedThugMax: response.data.deepIntel.estimatedThugMax,
        estimatedWorkerMin: response.data.deepIntel.estimatedWorkerMin,
        estimatedWorkerMax: response.data.deepIntel.estimatedWorkerMax,
        weaponReadinessBand: response.data.deepIntel.weaponReadinessBand,
        cashExposureBand: response.data.deepIntel.cashExposureBand,
        drugExposureBand: response.data.deepIntel.drugExposureBand,
        cartelPresence: response.data.deepIntel.cartelPresence,
        workforceStabilityBand: response.data.deepIntel.workforceStabilityBand,
        workforceProtectionBand: response.data.deepIntel.workforceProtectionBand,
        poachingOutlook: response.data.deepIntel.poachingOutlook,
        gatheredAt: response.data.deepIntel.scoutedAt,
      };
      const updated: AttackTargetCandidate = {
        ...selected,
        hasDeepIntel: true,
        deepIntelReportId: response.data.reportId,
        deepIntel,
      };
      setSelected(updated);
      setTargets((prev) =>
        prev.map((t) => (t.playerId === updated.playerId ? updated : t)),
      );
      setShowDeepIntel(true);
      reconcile(response.data.shell);
      if (refresh) setShowIntel(false);
    });
  }

  async function handleLaunch() {
    if (!selected?.reportId || !canAttack) return;
    const reportId = selected.reportId;
    await run('attack', async () => {
      setError('');
      try {
        const response = await launchAttackAction(
          reportId,
          attackType,
          Math.max(1, Math.floor(force)),
          uuidv4(),
        );
        if (!response.success) {
          const err = response.error;
          if (
            err.includes('below your attack range') ||
            err.includes('too far below your Influence') ||
            err.includes('too far below your Net Worth')
          ) {
            setSelected((prev) =>
              prev
                ? {
                    ...prev,
                    eligible: false,
                    eligibilityNote: GAMEPLAY_CONTEXT_MESSAGES.belowAttackRangeHeading,
                  }
                : prev,
            );
            router.refresh();
          }
          setError(err);
          setConfirming(false);
          return;
        }
        setResult(response.data);
        setTurns(response.data.newTurns);
        if (response.data.shell) {
          applyAttackShell(response.data.shell);
        }
      } catch (err) {
        setError('Something went wrong launching the attack. Try again.');
        setConfirming(false);
        console.error(err);
      }
    });
  }

  function handleBackToTargets() {
    setResult(null);
    setSelected(null);
    setShowIntel(false);
    setConfirming(false);
    setError('');
    router.replace('/attack');
  }

  if (result) {
    const presentation = buildCombatResultPresentation({
      attackType: result.attackType,
      outcome: result.outcome,
      outcomeLabel: result.outcomeLabel,
      targetAlias: result.targetAlias,
      cashStolen: result.cashStolen,
      workersStolen: result.workersStolen ?? 0,
      drugsStolen: result.drugsStolen,
      attackerLosses: result.attackerLosses,
      defenderLosses: result.defenderLosses,
      turnsSpent: result.turnsSpent,
      role: 'attacker',
    });

    const secondaryActions = [
      ...(result.attackerReportId
        ? [{ label: 'View Report', href: `/reports/${result.attackerReportId}` }]
        : []),
      { label: 'Home', href: '/command' },
    ];

    return (
      <CombatResultPanel
        presentation={presentation}
        primaryActions={[
          {
            label: 'Back to Targets',
            primary: true,
            icon: 'attack',
            onClick: handleBackToTargets,
          },
        ]}
        secondaryActions={secondaryActions}
      />
    );
  }

  if (!selected) {
    return (
      <>
        <AttackCrewSummary
          thugs={crew.thugs}
          rides={crew.rides}
          glocks={crew.glocks}
          uzis={crew.uzis}
          aks={crew.aks}
          force={0}
          weaponAlloc={allocateWeaponsForThugs(0, {
            glocks: crew.glocks,
            uzis: crew.uzis,
            aks: crew.aks,
          })}
        />
        {props.staleIntelNotice && <p className="g-error">{props.staleIntelNotice}</p>}
        {props.requestedTargetNotice && (
          <div className="g-error-block">
            {props.requestedTargetNotice.heading && (
              <p className="g-section-label">{props.requestedTargetNotice.heading}</p>
            )}
            <p className="g-error">{props.requestedTargetNotice.message}</p>
          </div>
        )}
        <p className="g-note">
          Players in <strong>{props.viewerCity}</strong> you can attack right now. Gather Basic
          Intel before launching an attack.
        </p>
        {props.attackRangeMinNetWorth != null &&
        props.attackRangeMaxNetWorth != null &&
        props.attackRangeMinNetWorth > 0 ? (
          <p className="g-note">
            Attack range: {Math.round(ATTACK_RULES.netWorthMinMultiplier * 100)}%–
            {Math.round(ATTACK_RULES.netWorthMaxMultiplier * 100)}% of your {OS_TERMS.influence}. Eligible
            targets: ${props.attackRangeMinNetWorth.toLocaleString()} – $
            {props.attackRangeMaxNetWorth.toLocaleString()} {OS_TERMS.influence}.
          </p>
        ) : null}
        {targets.length === 0 ? (
          <>
            <p className="g-note">
              No Operators in your city fall within your attack range right now (
              {Math.round(ATTACK_RULES.netWorthMinMultiplier * 100)}%–
              {Math.round(ATTACK_RULES.netWorthMaxMultiplier * 100)}% of your{' '}
              {OS_TERMS.influence.toLowerCase()}). Check{' '}
              <Link href="/rankings">Rankings</Link> for rivals in band, or{' '}
              <Link href="/travel">Travel</Link> to another city.
            </p>
          </>
        ) : (
          targets.map((target) => (
            <TargetCard
              key={target.playerId}
              target={target}
              onSelect={() => {
                setSelected(target);
                setShowIntel(!!target.hasIntel);
                setError('');
              }}
            />
          ))
        )}
      </>
    );
  }

  return (
    <div aria-busy={formLocked || undefined}>
      {props.staleIntelNotice && <p className="g-error">{props.staleIntelNotice}</p>}
      <PrimaryButton
        className="g-btn-full g-btn-secondary"
        variant="secondary"
        disabled={formLocked}
        onClick={() => {
          setSelected(null);
          setShowIntel(false);
          setConfirming(false);
          setError('');
        }}
      >
        ← All Targets
      </PrimaryButton>

      <PlayerIdentity
        player={{
          alias: selected.alias,
          ...selected.identity,
          aliasNormalized: selected.aliasNormalized,
          rank: selected.rank,
        }}
        avatarSize="lg"
        shape="square"
        showRank
        static
      />

      <StatRow label={OS_TERMS.influence} value={`$${selected.netWorth.toLocaleString()}`} />
      <StatRow label="Status" value={selected.statusLabel} />

      {!selected.eligible && (
        <p className="g-error">{selected.eligibilityNote}</p>
      )}

      <Divider />

      {selected.hasIntel && selected.bands ? (
        <>
          {showDeepIntel && selected.deepIntel ? (
            <>
              <p className="g-section-label">DEEP INTEL</p>
              <StatRow label="Target" value={selected.alias} />
              <StatRow label="City" value={props.viewerCity} />
              <StatRow
                label={`Estimated ${OS_TERMS.enforcers}`}
                value={formatCountEstimateRange(
                  selected.deepIntel.estimatedThugMin,
                  selected.deepIntel.estimatedThugMax,
                )}
              />
              <StatRow
                label={`Estimated ${OS_TERMS.specialists}`}
                value={formatCountEstimateRange(
                  selected.deepIntel.estimatedWorkerMin,
                  selected.deepIntel.estimatedWorkerMax,
                )}
              />
              <StatRow label="Weapon Readiness" value={selected.deepIntel.weaponReadinessBand} />
              <StatRow label="Workforce Stability" value={selected.deepIntel.workforceStabilityBand} />
              <StatRow label="Protection" value={selected.deepIntel.workforceProtectionBand} />
              <StatRow label="Cash Exposure" value={selected.deepIntel.cashExposureBand} />
              <StatRow
                label={`${OS_TERMS.technology} exposure`}
                value={selected.deepIntel.drugExposureBand}
              />
              {selected.deepIntel.cartelPresence && (
                <StatRow
                  label={OS_TERMS.faction}
                  value={displayFactionPresence(selected.deepIntel.cartelPresence)}
                />
              )}
              {workforceStabilityHint(selected.deepIntel.workforceStabilityBand as never) && (
                <p className="g-note">
                  {themeAttackIntelHint(
                    workforceStabilityHint(selected.deepIntel.workforceStabilityBand as never)!,
                  )}
                </p>
              )}
              <StatRow label="Intel age" value={formatIntelAge(selected.deepIntel.gatheredAt)} />
              {selected.deepIntelReportId && (
                <p className="g-note">
                  <Link href={`/reports/${selected.deepIntelReportId}`}>View in Reports</Link>
                </p>
              )}
              <PrimaryButton
                className="g-btn-full g-btn-secondary"
                variant="secondary"
                icon="intel"
                disabled={formLocked || turns < props.deepIntelTurnCost}
                pending={pendingKey === 'deep-intel'}
                onClick={() => handleGatherDeepIntel(true)}
              >
                {pendingKey === 'deep-intel'
                  ? ACTION_PENDING.deepIntel
                  : `Refresh Deep Intel — ${props.deepIntelTurnCost} Turns`}
              </PrimaryButton>
            </>
          ) : showIntel ? (
            <>
              <p className="g-section-label">INTEL REPORT</p>
              <StatRow label="Intel quality" value={`${selected.bands.confidence}%`} />
              <StatRow label={`${OS_TERMS.enforcer} presence`} value={selected.bands.thugs} />
              <StatRow label="Weapon coverage" value={selected.bands.weapons} />
              <StatRow label="Cash exposure" value={selected.bands.cash} />
              <StatRow label={`${OS_TERMS.technology} exposure`} value={selected.bands.drugs} />
              {selected.reportId && (
                <p className="g-note">
                  <Link href={`/reports/${selected.reportId}`}>View in Reports</Link>
                </p>
              )}
              {selected.hasDeepIntel && selected.deepIntel && (
                <PrimaryButton
                  className="g-btn-full g-btn-secondary"
                  variant="secondary"
                  icon="intel"
                  onClick={() => setShowDeepIntel(true)}
                >
                  View Deep Intel
                </PrimaryButton>
              )}
              {!selected.hasDeepIntel && (
                <PrimaryButton
                  className="g-btn-full"
                  icon="intel"
                  disabled={formLocked || turns < props.deepIntelTurnCost}
                  pending={pendingKey === 'deep-intel'}
                  onClick={() => handleGatherDeepIntel()}
                >
                  {pendingKey === 'deep-intel'
                    ? ACTION_PENDING.deepIntel
                    : `Gather Deep Intel — ${props.deepIntelTurnCost} Turns`}
                </PrimaryButton>
              )}
            </>
          ) : (
            <>
              <PrimaryButton
                className="g-btn-full g-btn-secondary"
                variant="secondary"
                icon="intel"
                onClick={() => setShowIntel(true)}
              >
                View Intel
              </PrimaryButton>
              {selected.hasDeepIntel && selected.deepIntel && (
                <PrimaryButton
                  className="g-btn-full g-btn-secondary"
                  variant="secondary"
                  icon="intel"
                  onClick={() => setShowDeepIntel(true)}
                >
                  View Deep Intel
                </PrimaryButton>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <p className="g-note">
            Gather intel for {props.intelTurnCost} turns to estimate their force before attacking.
          </p>
          <PrimaryButton
            className="g-btn-full"
            icon="intel"
            disabled={formLocked || turns < props.intelTurnCost}
            pending={pendingKey === 'intel'}
            onClick={handleGatherIntel}
          >
            {pendingKey === 'intel'
              ? ACTION_PENDING.intel
              : `Gather Intel — ${props.intelTurnCost} Turns`}
          </PrimaryButton>
        </>
      )}

      {selected.hasIntel && selected.reportId && (
        <>
          <AttackCrewSummary
            thugs={crew.thugs}
            rides={crew.rides}
            glocks={crew.glocks}
            uzis={crew.uzis}
            aks={crew.aks}
            force={force}
            weaponAlloc={weaponAlloc}
          />
          <Divider />
          <SectionLabel>Attack type</SectionLabel>
          <div className="g-attack-type-grid">
            <OptionGrid
              ariaLabel="Attack type"
              options={ATTACK_TYPES.map((type) => ({
                id: type,
                label: formatAttackTypeOptionLabel(type),
              }))}
              value={attackType}
              disabled={formLocked}
              onChange={(type) => {
                setAttackType(type);
                setConfirming(false);
              }}
            />
          </div>
          <p className="g-note g-attack-type-desc">{attackTypeDescription(attackType)}</p>
          {attackType === 'POACH_WORKERS' && selected.deepIntel && (
            <>
              <StatRow
                label="Workforce"
                value={formatCountEstimateRange(
                  selected.deepIntel.estimatedWorkerMin,
                  selected.deepIntel.estimatedWorkerMax,
                )}
              />
              <StatRow label="Stability" value={selected.deepIntel.workforceStabilityBand} />
              <StatRow label="Protection" value={selected.deepIntel.workforceProtectionBand} />
              <StatRow label="Extraction outlook" value={selected.deepIntel.poachingOutlook} />
              <p className="g-note">
                {themeAttackIntelHint(
                  poachingOutlookHint(selected.deepIntel.poachingOutlook as never),
                )}
              </p>
            </>
          )}

          <NumericInput
            id="attack-force"
            label={`${OS_TERMS.enforcers} to send`}
            value={forceRaw}
            disabled={formLocked}
            onChange={(raw, parsed) => {
              setForceRaw(raw);
              setForce(parsed ?? 0);
              setConfirming(false);
              setError('');
            }}
            suffix={OS_TERMS.enforcers.toLowerCase()}
          />

          <StatRow
            label="Weapon coverage"
            value={`${weaponPct}% · ${weaponCoverageBand(weaponAlloc.armedThugs, force)}`}
          />
          <StatRow label="Rides required" value={String(ridesNeeded)} />
          <StatRow label="Turn cost" value={formatAttackTurnCostDisplay(attackType)} />
          <StatRow label="Risk" value={riskFromForce(forceEstimateLabel)} />

          {attackType === 'HOME_INVASION' && selected.bands && (
            <StatRow label="Cash exposure (intel)" value={selected.bands.cash} />
          )}
          {attackType === 'RAID_DRUG_LABS' && selected.bands && (
            <StatRow label={`${OS_TERMS.technology} exposure (intel)`} value={selected.bands.drugs} />
          )}

          {turnCost > turns && (
            <p className="g-error">{formatInsufficientTurnsForAttack(attackType, turns)}</p>
          )}

          {poachBlockedByDeepIntel && (
            <p className="g-error">
              Deep Intel suggests this target does not have enough {OS_TERMS.specialists.toLowerCase()}{' '}
              to extract.
            </p>
          )}

          {ridesNeeded > crew.rides && (
            <p className="g-error">Need {ridesNeeded - crew.rides} more rides for this force.</p>
          )}

          {usingStaleReport && (
            <p className="g-error">
              This intel is for a player in another city. Pick a target in {props.viewerCity} or travel
              first.
            </p>
          )}

          {error && <p className="g-error">{error}</p>}

          {!confirming ? (
            <PrimaryButton
              className="g-btn-full g-btn-danger"
              icon="attack"
              iconTone="danger"
              disabled={!canAttack || formLocked}
              onClick={() => setConfirming(true)}
            >
              Attack
            </PrimaryButton>
          ) : (
            <div className="g-confirm">
              <p className="g-note">
                Launch <strong>{ATTACK_TYPE_LABELS[attackType]}</strong> on {selected.alias} with{' '}
                {force.toLocaleString()} {OS_TERMS.enforcers.toLowerCase()}?
              </p>
              <StatRow label="Turn cost" value={formatAttackTurnCostDisplay(attackType)} />
              <StatRow
                label={`${OS_TERMS.enforcers} committed`}
                value={force.toLocaleString()}
              />
              <StatRow label="Risk" value={riskFromForce(forceEstimateLabel)} />
              {attackType === 'HOME_INVASION' && selected.bands && (
                <StatRow label="Cash exposure (intel)" value={selected.bands.cash} />
              )}
              {attackType === 'RAID_DRUG_LABS' && selected.bands && (
                <StatRow
                  label={`${OS_TERMS.technology} exposure (intel)`}
                  value={selected.bands.drugs}
                />
              )}
              {attackType === 'POACH_WORKERS' && selected.deepIntel && (
                <StatRow label="Extraction outlook" value={selected.deepIntel.poachingOutlook} />
              )}
              {attackType === 'DRIVE_BY' && (
                <p className="g-note">Strike targets crew losses only — no Cash, stock, or Specialist transfer.</p>
              )}
              <PrimaryButton
                className="g-btn-full g-btn-danger"
                icon="attack"
                iconTone="danger"
                disabled={formLocked || !canAttack}
                pending={pendingKey === 'attack'}
                onClick={handleLaunch}
              >
                {pendingKey === 'attack' ? ACTION_PENDING.attack : 'Confirm Attack'}
              </PrimaryButton>
              <PrimaryButton
                className="g-btn-full g-btn-secondary"
                variant="secondary"
                disabled={formLocked}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </PrimaryButton>
            </div>
          )}
        </>
      )}

      {error && !selected.hasIntel && <p className="g-error">{error}</p>}
    </div>
  );
}

export type { AttackTargetCandidate };
