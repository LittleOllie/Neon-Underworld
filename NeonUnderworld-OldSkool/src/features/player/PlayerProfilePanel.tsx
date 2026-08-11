'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { ATTACK_RULES } from '@core/config/game/attack-rules';
import {
  thugBand,
  weaponStrengthBand,
  exposureBand,
  cartelProtectionBand,
  computeConfidencePercent,
} from '@core/lib/game-engine/combat/intel-bands';
import { scoutTargetAction } from '@local/server/actions/scout-target.actions';
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

interface Props {
  targetAlias: string;
  targetAliasNormalized: string;
  initialTurns: number;
  existingIntel: PlayerIntelDisplay | null;
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

function IntelReportStats({ intel }: { intel: PlayerIntelDisplay }) {
  return (
    <>
      <p className="g-section-label">INTEL REPORT</p>
      <StatRow label="Intel quality" value={`${intel.bands.confidence}%`} />
      <StatRow label="Thugs" value={intel.bands.thugs} />
      <StatRow label="Weapon coverage" value={intel.bands.weapons} />
      <StatRow label="Cash" value={intel.bands.cash} />
      <StatRow label="Drug stock" value={intel.bands.drugs} />
      <p className="g-note">
        <Link href={`/reports/${intel.reportId}`}>View in Reports</Link>
      </p>
    </>
  );
}

function CrossCityNotice({
  targetCity,
  intel,
}: {
  targetCity: string;
  intel: PlayerIntelDisplay | null;
}) {
  return (
    <>
      <Divider />
      <p className="g-section-label">CURRENT LOCATION</p>
      <StatRow label="City" value={targetCity.toUpperCase()} />
      <p className="g-note">Travel to {targetCity} — COMING SOON</p>
      {intel && (
        <>
          <p className="g-note">Historical intel from a previous visit — attack unavailable from here.</p>
          <IntelReportStats intel={intel} />
        </>
      )}
    </>
  );
}

export function PlayerProfilePanel({
  targetAlias,
  targetAliasNormalized,
  initialTurns,
  existingIntel,
  sameCity,
  targetCity,
  targetCitySlug,
}: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState(initialTurns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [intel, setIntel] = useState<PlayerIntelDisplay | null>(existingIntel);
  const intelTurnCost = ATTACK_RULES.intelGatherTurnCost;

  if (!sameCity) {
    return (
      <CrossCityNotice targetCity={targetCity} intel={intel} />
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
    router.refresh();
  }

  if (intel) {
    return (
      <>
        <IntelReportStats intel={intel} />
        <ActionButton
          className="g-btn-full g-btn-danger"
          icon="attack"
          href={`/attack?reportId=${intel.reportId}`}
        >
          View Intel / Attack
        </ActionButton>
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
