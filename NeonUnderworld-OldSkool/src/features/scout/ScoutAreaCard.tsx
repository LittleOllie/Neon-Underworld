'use client';

import {
  scoutRecruitmentTierPercent,
  scoutRiskTierPercent,
  type RecruitmentTier,
  type ScoutAreaDisplay,
  type ScoutRiskTier,
} from '@core/lib/game-engine/scout-display';
import { OS_TERMS } from '@local/config/terminology';

type Props = {
  area: ScoutAreaDisplay;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

function tierLevel(tier: RecruitmentTier | ScoutRiskTier): 'good' | 'warn' | 'danger' {
  if (tier === 'High') return 'danger';
  if (tier === 'Medium') return 'warn';
  return 'good';
}

function ScoutTierMeter({
  label,
  tier,
  variant,
}: {
  label: string;
  tier: RecruitmentTier | ScoutRiskTier;
  variant: 'yield' | 'risk';
}) {
  const percent =
    variant === 'risk'
      ? scoutRiskTierPercent(tier as ScoutRiskTier)
      : scoutRecruitmentTierPercent(tier as RecruitmentTier);
  const level = variant === 'risk' ? tierLevel(tier) : tier === 'High' ? 'good' : tier === 'Medium' ? 'warn' : 'danger';

  return (
    <div className="g-scout-tier">
      <span className="g-scout-tier__label">{label}</span>
      <div className="g-scout-tier__track" aria-hidden>
        <span
          className={`g-scout-tier__fill g-scout-tier__fill--${level}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`g-scout-tier__value g-scout-tier__value--${level}`}>{tier}</span>
    </div>
  );
}

export function ScoutAreaCard({ area, selected, disabled, onSelect }: Props) {
  return (
    <button
      type="button"
      className={`g-scout-area-card${selected ? ' g-scout-area-card--selected' : ''}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <div className="g-scout-area-card__head">
        <span className="g-scout-area-card__name">{area.name}</span>
        {selected ? <span className="g-scout-area-card__badge">Selected</span> : null}
      </div>

      <div className="g-scout-area-card__meters">
        <ScoutTierMeter label={OS_TERMS.specialists} tier={area.workers} variant="yield" />
        <ScoutTierMeter label={OS_TERMS.enforcers} tier={area.thugs} variant="yield" />
        <ScoutTierMeter label="Risk" tier={area.risk} variant="risk" />
      </div>

      {selected ? <p className="g-scout-area-card__tagline">{area.tagline}</p> : null}
    </button>
  );
}
