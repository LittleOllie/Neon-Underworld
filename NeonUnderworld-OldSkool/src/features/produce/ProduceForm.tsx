'use client';

import { useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { produceAction, type OldSkoolProduceResult } from '@local/server/actions/produce.actions';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult } from '@local/components/game/ActionResult';
import { validateTurnAmount } from '@local/lib/numeric-input';
import type { ProductionDrug } from '@core/lib/game-engine/production';

interface ProduceFormProps {
  initialTurns: number;
  thugCount: number;
}

const DRUGS: { key: ProductionDrug; label: string }[] = [
  { key: 'hash', label: 'Hash' },
  { key: 'shrooms', label: 'Shrooms' },
  { key: 'coke', label: 'Coke' },
  { key: 'heroin', label: 'Heroin' },
];

export function ProduceForm({ initialTurns, thugCount }: ProduceFormProps) {
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
  }

  if (result) {
    return (
      <ActionResult
        title="Production Complete"
        lines={[
          { text: `+${result.drugUnitsProduced.toLocaleString()} ${result.drugType}`, tone: 'positive' },
          { text: `+$${result.playerShare.toLocaleString()} your share`, tone: 'positive' },
          { text: `${result.turnsSpent} turns used` },
        ]}
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

      <PrimaryButton
        className="g-btn-full"
        icon="produce"
        onClick={handleProduce}
        disabled={loading || thugCount === 0}
      >
        {loading ? 'Producing…' : 'Produce'}
      </PrimaryButton>
    </>
  );
}
