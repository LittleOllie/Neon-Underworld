'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { scoutAction, type OldSkoolScoutResult } from '@local/server/actions/scout.actions';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import { assessScoutWalkoutRisk } from '@core/lib/game-engine/happiness';
import type { RedliteScoutAreaSlug } from '@core/config/game/redlite-rules';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult, type ActionResultLine } from '@local/components/game/ActionResult';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { workersLabel, thugsLabel } from '@local/config/terminology';
import { buildStreetIncomeBreakdownLines } from '@local/lib/income-breakdown';

interface ScoutFormProps {
  districtSlug: string;
  initialTurns: number;
  prostituteHappiness: number;
  thugHappiness: number;
  prostituteCount: number;
  thugCount: number;
}

export function ScoutForm({
  districtSlug,
  initialTurns,
  prostituteHappiness,
  thugHappiness,
  prostituteCount,
  thugCount,
}: ScoutFormProps) {
  const router = useRouter();
  const areaDisplays = getScoutAreaDisplays(districtSlug);
  const [turns, setTurns] = useState(initialTurns);
  const [amountRaw, setAmountRaw] = useState('25');
  const [amount, setAmount] = useState(25);
  const [areaSlug, setAreaSlug] = useState<RedliteScoutAreaSlug>('streets');
  const selectedArea = areaDisplays.find((area) => area.slug === areaSlug);
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
    router.refresh();
  }

  if (result) {
    const lines: ActionResultLine[] = [
      { text: `+${result.prostitutesFound} ${workersLabel(result.prostitutesFound)}`, tone: 'positive' },
      { text: `+${result.thugsFound} ${thugsLabel(result.thugsFound)}`, tone: 'positive' },
      ...buildStreetIncomeBreakdownLines({
        grossIncome: result.workerRevenueGross,
        workerPayoutShare: result.workerPayoutShare,
        playerShareBeforeCartel: result.playerShareBeforeCartel,
        cartelContribution: result.cartelContribution,
        retainedCash: result.cashEarned,
      }),
    ];
    if (result.prostitutesLost > 0) {
      lines.push({
        text: `${result.prostitutesLost} ${workersLabel(result.prostitutesLost)} walked out`,
        tone: 'negative',
      });
    }
    if (result.thugsLost > 0) {
      lines.push({
        text: `${result.thugsLost} ${thugsLabel(result.thugsLost)} walked out`,
        tone: 'negative',
      });
    }
    lines.push({ text: `${result.turnsSpent} turns used` });

    return (
      <ActionResult
        title="Scout Complete"
        lines={lines}
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
        {areaDisplays.map((area) => (
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

      {(() => {
        const walkout = assessScoutWalkoutRisk(
          amount,
          prostituteHappiness,
          thugHappiness,
          prostituteCount,
          thugCount,
        );
        if (walkout.level === 'none') return null;
        return (
          <p className={`g-note${walkout.level === 'critical' ? ' g-error' : ''}`} role="alert">
            {walkout.level === 'critical' ? 'LOW MORALE — ' : ''}
            {walkout.message}
          </p>
        );
      })()}

      <PrimaryButton className="g-btn-full" icon="scout" onClick={handleScout} disabled={loading} pending={loading}>
        {loading ? ACTION_PENDING.scout : `Scouting ${selectedArea?.name ?? 'Area'}`}
      </PrimaryButton>
    </>
  );
}
