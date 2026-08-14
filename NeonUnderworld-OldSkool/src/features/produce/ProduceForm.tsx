'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { useOptionalPlayerShell } from '@local/components/game/PlayerShellProvider';
import { produceAction, type OldSkoolProduceResult } from '@local/server/actions/produce.actions';
import { assessScoutWalkoutRisk } from '@core/lib/game-engine/happiness';
import { estimateProducePreview } from '@core/lib/game-engine/produce-economy';
import { TurnQuickAmounts } from '@local/components/game/TurnQuickAmounts';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { OptionGrid } from '@local/components/game/OptionGrid';
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
  drugLabBonus?: number;
}

const DRUGS: { key: ProductionDrug; label: string; hint: string }[] = [
  { key: 'hash', label: 'Hash', hint: 'High output · No hash upkeep during production' },
  { key: 'shrooms', label: 'Shrooms', hint: 'Reliable yield' },
  { key: 'coke', label: 'Coke', hint: 'High street value' },
  { key: 'heroin', label: 'Heroin', hint: 'Premium street value · Lower output' },
];

function formatDrugLabel(drugType: ProductionDrug): string {
  return DRUGS.find((d) => d.key === drugType)?.label ?? drugType;
}

export function ProduceForm({
  initialTurns,
  thugCount,
  prostituteCount,
  prostituteHappiness,
  thugHappiness,
  drugLabBonus = 0,
}: ProduceFormProps) {
  const reconcile = useGameplayReconcile();
  const shellCtx = useOptionalPlayerShell();
  const effectiveThugs = shellCtx?.stats.thugs ?? thugCount;
  const effectiveWorkers = shellCtx?.stats.workers ?? prostituteCount;
  const [turns, setTurns] = useState(initialTurns);
  const [amountRaw, setAmountRaw] = useState('25');
  const [amount, setAmount] = useState(25);
  const [drugType, setDrugType] = useState<ProductionDrug>('hash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OldSkoolProduceResult | null>(null);

  const preview = useMemo(() => {
    if (amount <= 0 || effectiveThugs <= 0) return null;
    return estimateProducePreview({
      turnsSpent: amount,
      thugCount: effectiveThugs,
      prostituteCount: effectiveWorkers,
      drugType,
      thugHappiness,
      workerHappiness: prostituteHappiness,
      drugProductionBonus: drugLabBonus,
    });
  }, [
    amount,
    effectiveThugs,
    effectiveWorkers,
    drugType,
    thugHappiness,
    prostituteHappiness,
    drugLabBonus,
  ]);

  function selectQuickAmount(next: number) {
    setAmountRaw(String(next));
    setAmount(next);
    setError('');
  }

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
    if (effectiveThugs === 0) {
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
    reconcile(response.data.shell);
  }

  if (result) {
    const lines: ActionResultLine[] = [
      ...buildSupplyImpactLines({
        drugType: result.drugType,
        drugUnitsProduced: result.drugUnitsProduced,
        suppliesUsed: result.suppliesUsed,
        hashNetChange: result.hashNetChange,
        workerMoraleBefore: result.workerMoraleBefore,
        workerMoraleAfter: result.workerMoraleAfter,
        thugMoraleBefore: result.thugMoraleBefore,
        thugMoraleAfter: result.thugMoraleAfter,
      }),
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
    if (result.businessBonusUnits && result.businessBonusUnits > 0) {
      lines.push({
        text: `Business Bonus: +${result.businessBonusUnits.toLocaleString()} units`,
        tone: 'positive',
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
    effectiveThugs,
  );

  const drugLabel = formatDrugLabel(drugType);

  return (
    <>
      {effectiveThugs === 0 && (
        <p className="g-note">
          Need thugs? <Link href="/scout">Scout to recruit</Link>
        </p>
      )}

      {drugLabBonus > 0 && (
        <p className="g-note">
          <strong>Business Bonus</strong> — Drug Labs: +{Math.round(drugLabBonus * 100)}% Production
        </p>
      )}

      <OptionGrid
        ariaLabel="Drug type"
        options={DRUGS.map((d) => ({ id: d.key, label: d.label }))}
        value={drugType}
        onChange={setDrugType}
      />

      {(() => {
        const selected = DRUGS.find((d) => d.key === drugType);
        return selected ? <p className="g-note">{selected.hint}</p> : null;
      })()}

      <NumericInput
        id="produce-turns"
        label="Turns to produce"
        value={amountRaw}
        onChange={handleAmountChange}
        suffix="turns"
      />

      <TurnQuickAmounts value={amount} onSelect={selectQuickAmount} />

      <p className="g-note">Supplies help keep your crew loyal and effective.</p>

      {preview && preview.drugMax > 0 && (
        <p className="g-note">
          Estimated output: {preview.drugMin.toLocaleString()}–{preview.drugMax.toLocaleString()}{' '}
          {drugLabel}
          {preview.playerCash > 0 && (
            <>
              {' '}
              · ~${preview.playerCash.toLocaleString()} cash
            </>
          )}
        </p>
      )}

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
        disabled={loading || effectiveThugs === 0}
        pending={loading}
      >
        {loading ? ACTION_PENDING.produce : 'Produce'}
      </PrimaryButton>
    </>
  );
}
