'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
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
  launchAttackAction,
  type AttackLaunchResult,
} from '@local/server/actions/attack.actions';
import { NumericInput } from '@local/components/game/NumericInput';
import { ActionButton } from '@local/components/game/ActionButton';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { StatRow } from '@local/components/game/StatRow';
import { parsePositiveInteger } from '@local/lib/numeric-input';
import type { AttackTargetRow } from './AttackForm.types';

interface AttackFormProps {
  thugs: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  turns: number;
  targets: AttackTargetRow[];
  initialReportId?: string;
}

const ATTACK_TYPES: AttackType[] = ['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS'];

function riskFromForce(estimate: string): string {
  if (estimate === 'Overwhelming Advantage' || estimate === 'Advantage') return 'Moderate';
  if (estimate === 'Even Match') return 'High';
  return 'Severe';
}

export function AttackForm(props: AttackFormProps) {
  const forceMax = Math.min(props.thugs, ATTACK_RULES.maxAttackingThugs);
  const defaultForce = Math.min(50, forceMax);

  const defaultReportId =
    props.initialReportId && props.targets.some((t) => t.reportId === props.initialReportId && t.eligible)
      ? props.initialReportId
      : props.targets.find((t) => t.eligible)?.reportId ?? '';

  const [selectedReportId, setSelectedReportId] = useState(defaultReportId);
  const [attackType, setAttackType] = useState<AttackType>('HOME_INVASION');
  const [forceRaw, setForceRaw] = useState(String(defaultForce));
  const [force, setForce] = useState(defaultForce);
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AttackLaunchResult | null>(null);

  const selectedTarget = props.targets.find((t) => t.reportId === selectedReportId) ?? null;

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
  const weaponPct =
    force <= 0 ? 0 : Math.round((weaponAlloc.armedThugs / force) * 100);

  const forceEstimateLabel = useMemo(() => {
    if (!selectedTarget) return 'Unknown';
    const defenderStrength =
      selectedTarget.bands.weapons === 'Heavily Armed'
        ? 500
        : selectedTarget.bands.weapons === 'Armed'
          ? 150
          : 40;
    const thugMult =
      selectedTarget.bands.thugs === 'Massive'
        ? 400
        : selectedTarget.bands.thugs === 'High'
          ? 150
          : selectedTarget.bands.thugs === 'Moderate'
            ? 60
            : 20;
    return forceEstimate(weaponAlloc.totalStrength, defenderStrength + thugMult);
  }, [selectedTarget, weaponAlloc.totalStrength]);

  const canAttack =
    selectedTarget?.eligible &&
    force > 0 &&
    force <= props.thugs &&
    force <= ATTACK_RULES.maxAttackingThugs &&
    ridesNeeded <= props.rides &&
    turnCost <= props.turns;

  function handleForceChange(raw: string, parsed: number | null) {
    setForceRaw(raw);
    setForce(parsed ?? 0);
    setConfirming(false);
    setError('');
  }

  async function handleLaunch() {
    if (!selectedReportId || !canAttack) return;
    setLoading(true);
    setError('');
    const response = await launchAttackAction(selectedReportId, attackType, force, uuidv4());
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      setConfirming(false);
      return;
    }
    setResult(response.data);
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
    lines.push({ text: `${result.defenderLosses} enemy losses` });
    lines.push({ text: `${result.turnsSpent} turns used` });

    return (
      <ActionResult
        title={`Attack ${result.outcome}`}
        lines={lines}
        actions={[
          {
            href: `/players/${encodeURIComponent(result.targetAlias)}`,
            label: 'Back to Target',
            primary: true,
            icon: 'player',
          },
        ]}
      />
    );
  }

  if (props.targets.length === 0) {
    return (
      <>
        <p className="g-note">Find a target through Rankings and scout them first.</p>
        <ActionButton href="/rankings" icon="rankings" className="g-btn-full">
          View Rankings
        </ActionButton>
      </>
    );
  }

  return (
    <>
      <label htmlFor="attackTarget" className="g-section-label">
        Target
      </label>
      <select
        id="attackTarget"
        className="g-select"
        value={selectedReportId}
        onChange={(e) => {
          setSelectedReportId(e.target.value);
          setConfirming(false);
        }}
      >
        {props.targets.map((t) => (
          <option key={t.reportId} value={t.reportId} disabled={!t.eligible}>
            {t.alias} — {t.eligible ? t.city : t.eligibilityNote}
          </option>
        ))}
      </select>

      {selectedTarget && !selectedTarget.eligible && (
        <p className="g-error">{selectedTarget.eligibilityNote}</p>
      )}

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
        onChange={handleForceChange}
        suffix="thugs"
      />

      {force > 0 && force > forceMax && (
        <p className="g-error">Maximum force is {forceMax.toLocaleString()} thugs.</p>
      )}

      <StatRow label="Weapon coverage" value={`${weaponPct}% · ${weaponCoverageBand(weaponAlloc.armedThugs, force)}`} />
      <StatRow label="Rides required" value={String(ridesNeeded)} />
      <StatRow label="Turn cost" value={String(turnCost)} />
      <StatRow label="Risk" value={riskFromForce(forceEstimateLabel)} />

      {ridesNeeded > props.rides && (
        <p className="g-error">Need {ridesNeeded - props.rides} more rides for this force.</p>
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
            Launch {ATTACK_TYPE_LABELS[attackType]} on {selectedTarget?.alias} with {force} thugs?
          </p>
          <PrimaryButton
            className="g-btn-full g-btn-danger"
            icon="attack"
            iconTone="danger"
            disabled={loading || !canAttack}
            onClick={handleLaunch}
          >
            {loading ? 'Launching…' : 'Confirm Attack'}
          </PrimaryButton>
          <PrimaryButton
            className="g-btn-full g-btn-secondary"
            variant="secondary"
            icon="failure"
            iconTone="muted"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </PrimaryButton>
        </div>
      )}
    </>
  );
}

export type { AttackTargetRow };
