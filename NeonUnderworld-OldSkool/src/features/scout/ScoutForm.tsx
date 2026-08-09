'use client';

import { useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { scoutAction, type OldSkoolScoutResult } from '@local/server/actions/scout.actions';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import type { RedliteScoutAreaSlug } from '@core/config/game/redlite-rules';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { workersLabel, thugsLabel } from '@local/config/terminology';

interface ScoutFormProps {
  initialTurns: number;
}

const AREA_DISPLAYS = getScoutAreaDisplays();

export function ScoutForm({ initialTurns }: ScoutFormProps) {
  const [turns, setTurns] = useState(initialTurns);
  const [amountRaw, setAmountRaw] = useState('25');
  const [amount, setAmount] = useState(25);
  const [areaSlug, setAreaSlug] = useState<RedliteScoutAreaSlug>('streets');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OldSkoolScoutResult | null>(null);

  function handleAmountChange(raw: string, parsed: number | null) {
    setAmountRaw(raw);
    setAmount(parsed ?? 0);
    setError('');
  }

  async function handleScout() {
    const validationError = validateTurnAmount(amount > 0 ? amount : null, turns);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError('');
    const response = await scoutAction(amount, uuidv4(), areaSlug);
    setLoading(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setResult(response.data);
    setTurns(response.data.newTurns);
  }

  if (result) {
    return (
      <ActionResult
        title="Scout Complete"
        lines={[
          { text: `+${result.prostitutesFound} ${workersLabel(result.prostitutesFound)}`, tone: 'positive' },
          { text: `+${result.thugsFound} ${thugsLabel(result.thugsFound)}`, tone: 'positive' },
          { text: `+$${result.cashEarned.toLocaleString()} retained income`, tone: 'positive' },
          { text: `${result.turnsSpent} turns used` },
        ]}
        actions={[
          {
            label: 'Scout Again',
            primary: true,
            icon: 'scout',
            onClick: () => setResult(null),
          },
        ]}
      />
    );
  }

  return (
    <>
      <div role="listbox" aria-label="Scout areas">
        {AREA_DISPLAYS.map((area) => (
          <button
            key={area.slug}
            type="button"
            role="option"
            aria-selected={areaSlug === area.slug}
            className={`g-area-row${areaSlug === area.slug ? ' g-area-row-selected' : ''}`}
            onClick={() => setAreaSlug(area.slug)}
          >
            <div className="g-area-name">{area.name}</div>
            <div className="g-area-meta">
              Workers: {area.workers} · Thugs: {area.thugs} · Risk: {area.risk}
            </div>
          </button>
        ))}
      </div>

      <NumericInput
        id="scout-turns"
        label="Turns to scout"
        value={amountRaw}
        onChange={handleAmountChange}
        suffix="turns"
      />

      {error && <p className="g-error">{error}</p>}

      <PrimaryButton className="g-btn-full" icon="scout" onClick={handleScout} disabled={loading}>
        {loading ? 'Scouting…' : 'Scout'}
      </PrimaryButton>
    </>
  );
}
