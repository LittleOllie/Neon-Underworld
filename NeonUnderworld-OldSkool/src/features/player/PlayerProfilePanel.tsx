'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { ATTACK_RULES } from '@core/config/game/attack-rules';
import {
  thugBand,
  weaponStrengthBand,
  exposureBand,
  cartelProtectionBand,
  computeConfidencePercent,
} from '@core/lib/game-engine/combat/intel-bands';
import { formatCountEstimateRange } from '@core/lib/game-engine/combat/deep-intel';
import { scoutTargetAction } from '@local/server/actions/scout-target.actions';
import { deepIntelTargetAction } from '@local/server/actions/deep-intel-target.actions';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionButton } from '@local/components/game/ActionButton';
import { StatRow } from '@local/components/game/StatRow';
import { Divider } from '@local/components/game/Divider';

export interface PlayerIntelDisplay {
  reportId: string;
  bands: {
    thugs: string;
    weapons: string;
    cash: string;
    drugs: string;
    cartel: string;
    confidence: number;
  };
  expiresAt: string;
}

export interface PlayerDeepIntelDisplay {
  reportId: string;
  estimatedThugMin: number;
  estimatedThugMax: number;
  estimatedWorkerMin: number;
  estimatedWorkerMax: number;
  weaponReadinessBand: string;
  cashExposureBand: string;
  drugExposureBand: string;
  cartelPresence: string | null;
  workforceStabilityBand: string;
  workforceProtectionBand: string;
  poachingOutlook: string;
  gatheredAt: string;
}

interface Props {
  targetAlias: string;
  targetAliasNormalized: string;
  initialTurns: number;
  existingIntel: PlayerIntelDisplay | null;
  existingDeepIntel: PlayerDeepIntelDisplay | null;
  sameCity: boolean;
  viewerCity: string;
  targetCity: string;
  targetCitySlug: string;
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

function formatIntelAge(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function IntelReportStats({ intel }: { intel: PlayerIntelDisplay }) {
  return (
    <>
      <p className="g-section-label">INTEL REPORT</p>
      <StatRow label="Intel quality" value={`${intel.bands.confidence}%`} />
      <StatRow label="Thug presence" value={intel.bands.thugs} />
      <StatRow label="Weapon coverage" value={intel.bands.weapons} />
      <StatRow label="Cash exposure" value={intel.bands.cash} />
      <StatRow label="Drug exposure" value={intel.bands.drugs} />
      <p className="g-note">
        <Link href={`/reports/${intel.reportId}`}>View in Reports</Link>
      </p>
    </>
  );
}

function DeepIntelReportStats({ deepIntel }: { deepIntel: PlayerDeepIntelDisplay }) {
  return (
    <>
      <p className="g-section-label">DEEP INTEL</p>
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
      <StatRow label="Intel age" value={formatIntelAge(deepIntel.gatheredAt)} />
      <p className="g-note">
        <Link href={`/reports/${deepIntel.reportId}`}>View in Reports</Link>
      </p>
    </>
  );
}

function CrossCityNotice({
  targetCity,
  targetCitySlug,
  intel,
  deepIntel,
}: {
  targetCity: string;
  targetCitySlug: string;
  intel: PlayerIntelDisplay | null;
  deepIntel: PlayerDeepIntelDisplay | null;
}) {
  return (
    <>
      <Divider />
      <p className="g-section-label">CURRENT LOCATION</p>
      <StatRow label="City" value={targetCity.toUpperCase()} />
      <ActionButton className="g-btn-full" icon="travel" href={`/travel?destination=${encodeURIComponent(targetCitySlug)}`}>
        Travel to {targetCity}
      </ActionButton>
      {(intel || deepIntel) && (
        <p className="g-note">Historical intel from a previous visit — attack unavailable from here.</p>
      )}
      {intel && <IntelReportStats intel={intel} />}
      {deepIntel && <DeepIntelReportStats deepIntel={deepIntel} />}
    </>
  );
}

export function PlayerProfilePanel({
  targetAlias,
  targetAliasNormalized,
  initialTurns,
  existingIntel,
  existingDeepIntel,
  sameCity,
  targetCity,
  targetCitySlug,
}: Props) {
  const reconcile = useGameplayReconcile();
  const [turns, setTurns] = useState(initialTurns);
  const [loading, setLoading] = useState(false);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState('');
  const [intel, setIntel] = useState<PlayerIntelDisplay | null>(existingIntel);
  const [deepIntel, setDeepIntel] = useState<PlayerDeepIntelDisplay | null>(existingDeepIntel);
  const [showDeep, setShowDeep] = useState(false);
  const intelTurnCost = ATTACK_RULES.intelGatherTurnCost;
  const deepIntelTurnCost = ATTACK_RULES.deepIntelTurnCost;

  useEffect(() => {
    setIntel(existingIntel);
    setDeepIntel(existingDeepIntel);
  }, [existingIntel, existingDeepIntel]);

  if (!sameCity) {
    return (
      <CrossCityNotice
        targetCity={targetCity}
        targetCitySlug={targetCitySlug}
        intel={intel}
        deepIntel={deepIntel}
      />
    );
  }

  async function handleGatherIntel() {
    setLoading(true);
    setError('');
    const response = await scoutTargetAction(targetAlias, uuidv4());
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setTurns(response.data.newTurns);
    setIntel({
      reportId: response.data.reportId,
      bands: bandsFromIntel(response.data.intel),
      expiresAt: response.data.intel.expiresAt,
    });
    reconcile(response.data.shell);
  }

  async function handleGatherDeepIntel() {
    setDeepLoading(true);
    setError('');
    const response = await deepIntelTargetAction(targetAlias, uuidv4());
    setDeepLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setTurns(response.data.newTurns);
    setDeepIntel({
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
    });
    setShowDeep(true);
    reconcile(response.data.shell);
  }

  if (intel) {
    return (
      <>
        {showDeep && deepIntel ? (
          <DeepIntelReportStats deepIntel={deepIntel} />
        ) : (
          <IntelReportStats intel={intel} />
        )}
        {deepIntel && !showDeep && (
          <PrimaryButton
            className="g-btn-full g-btn-secondary"
            variant="secondary"
            icon="intel"
            onClick={() => setShowDeep(true)}
          >
            View Deep Intel
          </PrimaryButton>
        )}
        {showDeep && (
          <PrimaryButton
            className="g-btn-full g-btn-secondary"
            variant="secondary"
            onClick={() => setShowDeep(false)}
          >
            View Basic Intel
          </PrimaryButton>
        )}
        {!deepIntel && (
          <PrimaryButton
            className="g-btn-full"
            icon="intel"
            onClick={handleGatherDeepIntel}
            disabled={deepLoading || turns < deepIntelTurnCost}
          >
            {deepLoading
              ? 'Gathering…'
              : `Gather Deep Intel — ${deepIntelTurnCost} Turns`}
          </PrimaryButton>
        )}
        {deepIntel && (
          <PrimaryButton
            className="g-btn-full g-btn-secondary"
            variant="secondary"
            icon="intel"
            onClick={handleGatherDeepIntel}
            disabled={deepLoading || turns < deepIntelTurnCost}
          >
            {deepLoading
              ? 'Gathering…'
              : `Refresh Deep Intel — ${deepIntelTurnCost} Turns`}
          </PrimaryButton>
        )}
        <ActionButton
          className="g-btn-full g-btn-danger"
          icon="attack"
          href={`/attack?reportId=${intel.reportId}`}
        >
          View Intel / Attack
        </ActionButton>
        {error && <p className="g-error">{error}</p>}
      </>
    );
  }

  return (
    <>
      <Divider />
      <p className="g-note">No current intel on this player.</p>
      <p className="g-note">
        Gather intel for {intelTurnCost} turns to see force estimates before attacking.
      </p>
      {error && <p className="g-error">{error}</p>}
      <PrimaryButton
        className="g-btn-full"
        icon="intel"
        onClick={handleGatherIntel}
        disabled={loading || turns < intelTurnCost}
      >
        {loading ? 'Gathering…' : `Gather Intel — ${intelTurnCost} Turns`}
      </PrimaryButton>
      <ActionButton
        className="g-btn-full g-btn-secondary"
        icon="attack"
        href={`/attack?target=${encodeURIComponent(targetAliasNormalized)}`}
      >
        Open in Attack
      </ActionButton>
    </>
  );
}
