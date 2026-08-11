'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { produceAction, type OldSkoolProduceResult } from '@local/server/actions/produce.actions';
import { assessScoutWalkoutRisk } from '@core/lib/game-engine/happiness';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult, type ActionResultLine } from '@local/components/game/ActionResult';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { workersLabel, thugsLabel } from '@local/config/terminology';
import { buildStreetIncomeBreakdownLines } from '@local/lib/income-breakdown';
import { buildSupplyImpactLines } from '@local/lib/supply-result-lines';
import type { ProductionDrug } from '@core/lib/game-engine/production';

interface ProduceFormProps {
  initialTurns: number;
  thugCount: number;
  prostituteCount: number;
  prostituteHappiness: number;
  thugHappiness: number;
}

const DRUGS: { key: ProductionDrug; label: string }[] = [
  { key: 'hash', label: 'Hash' },
  { key: 'shrooms', label: 'Shrooms' },
  { key: 'coke', label: 'Coke' },
  { key: 'heroin', label: 'Heroin' },
];

export function ProduceForm({
  initialTurns,
  thugCount,
  prostituteCount,
  prostituteHappiness,
  thugHappiness,
}: ProduceFormProps) {
  const router = useRouter();
  const [turns, setTurns] = useState(initialTurns);
  const [amountRaw, setAmountRaw] = useState('100');
  const [amount, setAmount] = useState(100);
  const [drugType, setDrugType] = useState<ProductionDrug>('hash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OldSkoolProduceResult | null>(null);

  function handleAmountChange(raw: string, parsed: number | null) {
    setAmountRaw(raw);
    setAmount(parsed ?? 0);
    setError('');
  }

  async function handleProduce() {
    const validationError = validateTurnAmount(amount > 0 ? amount : null, turns);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (thugCount === 0) {
      setError('You need thugs to produce. Scout to recruit personnel.');
      return;
    }
    setLoading(true);
    setError('');
    const response = await produceAction(amount, drugType, uuidv4());
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
      { text: `+${result.drugUnitsProduced.toLocaleString()} ${result.drugType}`, tone: 'positive' },
      ...buildStreetIncomeBreakdownLines({
        grossIncome: result.workerRevenueGross,
        workerPayoutShare: result.workerPayoutShare,
        playerShareBeforeCartel: result.playerShareBeforeCartel,
        cartelContribution: result.cartelContribution,
        retainedCash: result.cashEarned,
      }),
      ...buildSupplyImpactLines(result),
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
        title="Production Complete"
        lines={lines}
        actions={[
          {
            label: 'Produce Again',
            primary: true,
            icon: 'produce',
            onClick: () => setResult(null),
          },
        ]}
      />
    );
  }

  const walkout = assessScoutWalkoutRisk(
    amount,
    prostituteHappiness,
    thugHappiness,
    prostituteCount,
    thugCount,
  );

  return (
    <>
      {thugCount === 0 && (
        <p className="g-note">
          Need thugs? <Link href="/scout">Scout to recruit</Link>
        </p>
      )}

      <div className="g-drug-grid">
        {DRUGS.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`g-drug-btn${drugType === d.key ? ' g-drug-btn-active' : ''}`}
            onClick={() => setDrugType(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <NumericInput
        id="produce-turns"
        label="Turns to produce"
        value={amountRaw}
        onChange={handleAmountChange}
        suffix="turns"
      />

      {error && <p className="g-error">{error}</p>}

      {walkout.level !== 'none' && (
        <p className={`g-note${walkout.level === 'critical' ? ' g-error' : ''}`} role="alert">
          {walkout.level === 'critical' ? 'LOW MORALE — ' : ''}
          {walkout.message}
        </p>
      )}

      <PrimaryButton
        className="g-btn-full"
        icon="produce"
        onClick={handleProduce}
        disabled={loading || thugCount === 0}
        pending={loading}
      >
        {loading ? ACTION_PENDING.produce : 'Produce'}
      </PrimaryButton>
    </>
  );
}
