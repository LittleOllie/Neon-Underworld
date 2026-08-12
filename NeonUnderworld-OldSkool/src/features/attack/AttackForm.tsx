'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import type { PlayerShellSnapshot } from '@local/domain/player-shell.model';
import {
  ATTACK_RULES,
  ATTACK_TYPE_LABELS,
  type AttackType,
} from '@core/config/game/attack-rules';
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
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { StatRow } from '@local/components/game/StatRow';
import { Divider } from '@local/components/game/Divider';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { formatRank } from '@local/lib/format-rank';
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
  attackRangeMinNetWorth?: number;
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

const ATTACK_TYPES: AttackType[] = ['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS'];

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
    aks > 0 ? `${aks.toLocaleString()} AK` : null,
    uzis > 0 ? `${uzis.toLocaleString()} Uzi` : null,
    glocks > 0 ? `${glocks.toLocaleString()} Glock` : null,
  ].filter((part): part is string => part != null);

  return parts.length > 0 ? parts.join(' · ') : 'None';
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
      <StatRow label="Thugs available" value={thugs.toLocaleString()} />
      <StatRow label="Rides" value={rides.toLocaleString()} />
      <StatRow label="Weapons owned" value={formatOwnedWeapons(aks, uzis, glocks)} />
      {force > 0 && (
        <>
          <p className="g-note">
            Sending {force.toLocaleString()} thugs — strongest weapons assigned first (AK → Uzi →
            Glock).
          </p>
          {weaponAlloc.aks > 0 && (
            <StatRow label="AK-47 armed" value={weaponAlloc.aks.toLocaleString()} />
          )}
          {weaponAlloc.uzis > 0 && (
            <StatRow label="Uzi armed" value={weaponAlloc.uzis.toLocaleString()} />
          )}
          {weaponAlloc.glocks > 0 && (
            <StatRow label="Glock armed" value={weaponAlloc.glocks.toLocaleString()} />
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
    <div className="g-attack-target-card">
      <div className="g-attack-target-header">
        <span className="g-attack-target-alias">{target.alias}</span>
        {target.hasIntel && <span className="g-attack-target-tag">Intel available</span>}
        {!target.eligible && (
          <span className="g-attack-target-tag g-attack-target-tag-muted">
            {target.eligibilityNote}
          </span>
        )}
      </div>
      <StatRow label="Net Worth" value={`$${target.netWorth.toLocaleString()}`} />
      <StatRow label="Rank" value={formatRank(target.rank)} />
      <StatRow label="Status" value={target.statusLabel} />
      <PrimaryButton className="g-btn-full g-btn-secondary" variant="secondary" onClick={onSelect}>
        {target.hasIntel ? 'View Intel / Attack' : 'Select Target'}
      </PrimaryButton>
    </div>
  );
}

export function AttackForm(props: AttackFormProps) {
  const router = useRouter();
  const reconcile = useGameplayReconcile();
  const [targets, setTargets] = useState(props.targets);
  const [turns, setTurns] = useState(props.turns);
  const [selected, setSelected] = useState<AttackTargetCandidate | null>(() =>
    resolveInitialTarget(props.targets, props.initialTargetAlias, props.initialReportId),
  );
  const [intelLoading, setIntelLoading] = useState(false);
  const [deepIntelLoading, setDeepIntelLoading] = useState(false);
  const [showIntel, setShowIntel] = useState(false);
  const [showDeepIntel, setShowDeepIntel] = useState(false);

  const forceMax = Math.min(props.thugs, ATTACK_RULES.maxAttackingThugs);
  const defaultForce = Math.min(50, forceMax);
  const [attackType, setAttackType] = useState<AttackType>('HOME_INVASION');
  const [forceRaw, setForceRaw] = useState(String(defaultForce));
  const [force, setForce] = useState(defaultForce);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OldSkoolAttackLaunchResult | null>(null);

  useEffect(() => {
    setTargets(props.targets);
    setTurns(props.turns);
  }, [props.targets, props.turns]);

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
        glocks: props.glocks,
        uzis: props.uzis,
        aks: props.aks,
      }),
    [force, props.glocks, props.uzis, props.aks],
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

  const canAttack =
    selected?.eligible &&
    selected.reportId &&
    !usingStaleReport &&
    force > 0 &&
    force <= props.thugs &&
    force <= ATTACK_RULES.maxAttackingThugs &&
    ridesNeeded <= props.rides &&
    turnCost <= turns;

  async function handleGatherIntel() {
    if (!selected) return;
    setIntelLoading(true);
    setError('');
    const response = await scoutTargetAction(selected.alias, uuidv4());
    setIntelLoading(false);
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
  }

  async function handleGatherDeepIntel(refresh = false) {
    if (!selected) return;
    setDeepIntelLoading(true);
    setError('');
    const response = await deepIntelTargetAction(selected.alias, uuidv4());
    setDeepIntelLoading(false);
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
  }

  async function handleLaunch() {
    if (!selected?.reportId || !canAttack) return;
    setLoading(true);
    setError('');
    try {
      const response = await launchAttackAction(
        selected.reportId,
        attackType,
        Math.max(1, Math.floor(force)),
        uuidv4(),
      );
      if (!response.success) {
        setError(response.error);
        setConfirming(false);
        return;
      }
      setResult(response.data);
      setTurns(response.data.newTurns);
      if (response.data.shell) {
        reconcile(response.data.shell);
      }
    } catch (err) {
      setError('Something went wrong launching the attack. Try again.');
      setConfirming(false);
      console.error(err);
    } finally {
      setLoading(false);
    }
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
    const lines: { text: string; tone?: 'positive' | 'negative' | 'neutral' }[] = [
      { text: result.outcomeLabel },
    ];
    if (result.cashStolen > 0) {
      lines.push({ text: `+$${result.cashStolen.toLocaleString()} stolen`, tone: 'positive' });
    }
    if (result.attackerLosses > 0) {
      lines.push({ text: `-${result.attackerLosses} thugs lost`, tone: 'negative' });
    }
    lines.push({ text: `${result.turnsSpent} turns used` });

    return (
      <ActionResult
        title={`Attack ${result.outcome}`}
        lines={lines}
        actions={[
          {
            label: 'Back to Targets',
            primary: true,
            icon: 'attack',
            onClick: handleBackToTargets,
          },
        ]}
      />
    );
  }

  if (!selected) {
    return (
      <>
        <AttackCrewSummary
          thugs={props.thugs}
          rides={props.rides}
          glocks={props.glocks}
          uzis={props.uzis}
          aks={props.aks}
          force={0}
          weaponAlloc={allocateWeaponsForThugs(0, {
            glocks: props.glocks,
            uzis: props.uzis,
            aks: props.aks,
          })}
        />
        {props.staleIntelNotice && <p className="g-error">{props.staleIntelNotice}</p>}
        <p className="g-note">
          Players in <strong>{props.viewerCity}</strong> you can attack right now. Gather intel
          before launching an attack.
        </p>
        {props.attackRangeMinNetWorth != null && props.attackRangeMinNetWorth > 0 && (
          <p className="g-note">
            Attack range: targets worth at least $
            {props.attackRangeMinNetWorth.toLocaleString()}+
          </p>
        )}
        {targets.length === 0 ? (
          <>
            <p className="g-note">
              No attackable players in your city right now. Check{' '}
              <Link href="/rankings">Rankings</Link> to find rivals elsewhere, then{' '}
              <Link href="/travel">Travel</Link> to their city.
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
    <>
      {props.staleIntelNotice && <p className="g-error">{props.staleIntelNotice}</p>}
      <PrimaryButton
        className="g-btn-full g-btn-secondary"
        variant="secondary"
        onClick={() => {
          setSelected(null);
          setShowIntel(false);
          setConfirming(false);
          setError('');
        }}
      >
        ← All Targets
      </PrimaryButton>

      <p className="g-section-label">{selected.alias}</p>
      <StatRow label="Net Worth" value={`$${selected.netWorth.toLocaleString()}`} />
      <StatRow label="Rank" value={formatRank(selected.rank)} />
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
                label="Estimated Thugs"
                value={formatCountEstimateRange(
                  selected.deepIntel.estimatedThugMin,
                  selected.deepIntel.estimatedThugMax,
                )}
              />
              <StatRow
                label="Estimated Workers"
                value={formatCountEstimateRange(
                  selected.deepIntel.estimatedWorkerMin,
                  selected.deepIntel.estimatedWorkerMax,
                )}
              />
              <StatRow label="Weapon Readiness" value={selected.deepIntel.weaponReadinessBand} />
              <StatRow label="Cash Exposure" value={selected.deepIntel.cashExposureBand} />
              <StatRow label="Drug Exposure" value={selected.deepIntel.drugExposureBand} />
              {selected.deepIntel.cartelPresence && (
                <StatRow label="Cartel" value={selected.deepIntel.cartelPresence} />
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
                disabled={deepIntelLoading || turns < props.deepIntelTurnCost}
                onClick={() => handleGatherDeepIntel(true)}
              >
                {deepIntelLoading
                  ? 'Gathering…'
                  : `Refresh Deep Intel — ${props.deepIntelTurnCost} Turns`}
              </PrimaryButton>
            </>
          ) : showIntel ? (
            <>
              <p className="g-section-label">INTEL REPORT</p>
              <StatRow label="Intel quality" value={`${selected.bands.confidence}%`} />
              <StatRow label="Thug presence" value={selected.bands.thugs} />
              <StatRow label="Weapon coverage" value={selected.bands.weapons} />
              <StatRow label="Cash exposure" value={selected.bands.cash} />
              <StatRow label="Drug exposure" value={selected.bands.drugs} />
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
                  disabled={deepIntelLoading || turns < props.deepIntelTurnCost}
                  onClick={() => handleGatherDeepIntel()}
                >
                  {deepIntelLoading
                    ? 'Gathering…'
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
            disabled={intelLoading || turns < props.intelTurnCost}
            onClick={handleGatherIntel}
          >
            {intelLoading ? 'Gathering…' : `Gather Intel — ${props.intelTurnCost} Turns`}
          </PrimaryButton>
        </>
      )}

      {selected.hasIntel && selected.reportId && (
        <>
          <AttackCrewSummary
            thugs={props.thugs}
            rides={props.rides}
            glocks={props.glocks}
            uzis={props.uzis}
            aks={props.aks}
            force={force}
            weaponAlloc={weaponAlloc}
          />
          <Divider />
          <label htmlFor="attackType" className="g-section-label">
            Attack type
          </label>
          <select
            id="attackType"
            className="g-select"
            value={attackType}
            onChange={(e) => {
              setAttackType(e.target.value as AttackType);
              setConfirming(false);
            }}
          >
            {ATTACK_TYPES.map((type) => (
              <option key={type} value={type}>
                {ATTACK_TYPE_LABELS[type]} ({ATTACK_RULES.turnCosts[type]} turns)
              </option>
            ))}
          </select>

          <NumericInput
            id="attack-force"
            label="Thugs to send"
            value={forceRaw}
            onChange={(raw, parsed) => {
              setForceRaw(raw);
              setForce(parsed ?? 0);
              setConfirming(false);
              setError('');
            }}
            suffix="thugs"
          />

          <StatRow
            label="Weapon coverage"
            value={`${weaponPct}% · ${weaponCoverageBand(weaponAlloc.armedThugs, force)}`}
          />
          <StatRow label="Rides required" value={String(ridesNeeded)} />
          <StatRow label="Turn cost" value={String(turnCost)} />
          <StatRow label="Risk" value={riskFromForce(forceEstimateLabel)} />

          {ridesNeeded > props.rides && (
            <p className="g-error">Need {ridesNeeded - props.rides} more rides for this force.</p>
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
              disabled={!canAttack}
              onClick={() => setConfirming(true)}
            >
              Attack
            </PrimaryButton>
          ) : (
            <div className="g-confirm">
              <p className="g-note">
                Launch {ATTACK_TYPE_LABELS[attackType]} on {selected.alias} with {force} thugs?
              </p>
              <PrimaryButton
                className="g-btn-full g-btn-danger"
                icon="attack"
                iconTone="danger"
                disabled={loading || !canAttack}
                pending={loading}
                onClick={handleLaunch}
              >
                {loading ? ACTION_PENDING.attack : 'Confirm Attack'}
              </PrimaryButton>
              <PrimaryButton
                className="g-btn-full g-btn-secondary"
                variant="secondary"
                onClick={() => setConfirming(false)}
              >
                Cancel
              </PrimaryButton>
            </div>
          )}
        </>
      )}

      {error && !selected.hasIntel && <p className="g-error">{error}</p>}
    </>
  );
}

export type { AttackTargetCandidate };
