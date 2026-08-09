'use client';

import { useState } from 'react';
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
  initialTurns: number;
  existingIntel: PlayerIntelDisplay | null;
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

export function PlayerProfilePanel({ targetAlias, initialTurns, existingIntel }: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState(initialTurns);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [intel, setIntel] = useState<PlayerIntelDisplay | null>(existingIntel);

  async function handleScout() {
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
        <Divider />
        <p className="g-section-label">SCOUT REPORT</p>
        <StatRow label="Intel quality" value={`${intel.bands.confidence}%`} />
        <StatRow label="Thugs" value={intel.bands.thugs} />
        <StatRow label="Weapon coverage" value={intel.bands.weapons} />
        <StatRow label="Cash" value={intel.bands.cash} />
        <StatRow label="Drug stock" value={intel.bands.drugs} />
        <PrimaryButton
          className="g-btn-full"
          icon="attack"
          iconTone="danger"
          onClick={() => router.push(`/attack?reportId=${intel.reportId}`)}
        >
          Attack Player
        </PrimaryButton>
        <p className="g-note">
          <Link href={`/reports/${intel.reportId}`}>View in Reports</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Divider />
      <p className="g-note">No current intel on this player.</p>
      <p className="g-note">Scout for {ATTACK_RULES.scoutIntelTurnCost} turns.</p>
      {error && <p className="g-error">{error}</p>}
      <PrimaryButton
        className="g-btn-full"
        icon="scout"
        onClick={handleScout}
        disabled={loading || turns < ATTACK_RULES.scoutIntelTurnCost}
      >
        {loading ? 'Scouting…' : `Scout Player — ${ATTACK_RULES.scoutIntelTurnCost} Turns`}
      </PrimaryButton>
    </>
  );
}
