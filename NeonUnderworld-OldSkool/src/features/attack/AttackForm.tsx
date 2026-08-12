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
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { StatRow } from '@local/components/game/StatRow';
import { Divider } from '@local/components/game/Divider';
import { formatRank } from '@local/lib/format-rank';
import type { AttackTargetCandidate } from './AttackForm.types';

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
  viewerCity: string;
}

const ATTACK_TYPES: AttackType[] = ['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS'];

function riskFromForce(estimate: string): string {
  if (estimate === 'Unknown') return 'Unknown';
  if (estimate === 'Overwhelming Advantage' || estimate === 'Advantage') return 'Moderate';
  if (estimate === 'Even Match') return 'High';
  return 'Severe';
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
  const [showIntel, setShowIntel] = useState(false);

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
    const thugMult =
      selected.bands.thugs === 'Massive'
        ? 400
        : selected.bands.thugs === 'High'
          ? 150
          : selected.bands.thugs === 'Moderate'
            ? 60
            : 20;
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
              <Link href="/rankings">Rankings</Link> to find rivals in other cities (travel — COMING
              SOON).
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
          {showIntel ? (
            <>
              <p className="g-section-label">INTEL REPORT</p>
              <StatRow label="Intel quality" value={`${selected.bands.confidence}%`} />
              <StatRow label="Thugs" value={selected.bands.thugs} />
              <StatRow label="Weapon coverage" value={selected.bands.weapons} />
              <StatRow label="Cash" value={selected.bands.cash} />
              <StatRow label="Drug stock" value={selected.bands.drugs} />
              {selected.reportId && (
                <p className="g-note">
                  <Link href={`/reports/${selected.reportId}`}>View in Reports</Link>
                </p>
              )}
            </>
          ) : (
            <PrimaryButton
              className="g-btn-full g-btn-secondary"
              variant="secondary"
              icon="intel"
              onClick={() => setShowIntel(true)}
            >
              View Intel
            </PrimaryButton>
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
