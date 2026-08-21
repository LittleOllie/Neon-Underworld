'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { useMutationLock } from '@local/hooks/useMutationLock';
import { useOptionalPlayerShell } from '@local/components/game/PlayerShellProvider';
import { produceAction, type OldSkoolProduceResult } from '@local/server/actions/produce.actions';
import { assessScoutWalkoutRisk } from '@core/lib/game-engine/happiness';
import { estimateProducePreview } from '@core/lib/game-engine/produce-economy';
import { TurnQuickAmounts } from '@local/components/game/TurnQuickAmounts';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { ActionResult, type ActionResultLine } from '@local/components/game/ActionResult';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { resourceLabel, OS_TERMS, workersLabel, thugsLabel } from '@local/config/terminology';
import { buildStreetIncomeBreakdownLines } from '@local/lib/income-breakdown';
import { buildSupplyImpactLines } from '@local/lib/supply-result-lines';
import { PRODUCE_RESULT_SECONDARY_ACTIONS } from '@local/lib/produce-result-actions';
import type { ProductionDrug } from '@core/lib/game-engine/production';
import { OperationsResourceCard } from '@local/features/produce/OperationsResourceCard';

interface ProduceFormProps {
  initialTurns: number;
  thugCount: number;
  prostituteCount: number;
  prostituteHappiness: number;
  thugHappiness: number;
  drugLabBonus?: number;
}

const OPERATION_RESOURCES: { key: ProductionDrug; label: string; hint: string }[] = [
  {
    key: 'hash',
    label: resourceLabel('hash'),
    hint: 'High output · steady baseline manufacturing',
  },
  {
    key: 'shrooms',
    label: resourceLabel('shrooms'),
    hint: 'Reliable yield',
  },
  {
    key: 'coke',
    label: resourceLabel('coke'),
    hint: 'Strong street value',
  },
  {
    key: 'heroin',
    label: resourceLabel('heroin'),
    hint: 'Premium value · lower output',
  },
];

function formatResourceLabel(drugType: ProductionDrug): string {
  return OPERATION_RESOURCES.find((d) => d.key === drugType)?.label ?? drugType;
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
  const { locked: pending, run } = useMutationLock();
  const shellCtx = useOptionalPlayerShell();
  const effectiveThugs = shellCtx?.stats.thugs ?? thugCount;
  const effectiveWorkers = shellCtx?.stats.workers ?? prostituteCount;
  const [turns, setTurns] = useState(initialTurns);
  const [amountRaw, setAmountRaw] = useState('25');
  const [amount, setAmount] = useState(25);
  const [drugType, setDrugType] = useState<ProductionDrug>('hash');
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
      setError(`You need ${OS_TERMS.enforcers.toLowerCase()} to run Operations. Scout to recruit crew.`);
      return;
    }
    await run('produce', async () => {
      setError('');
      const response = await produceAction(amount, drugType, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      setResult(response.data);
      setTurns(response.data.newTurns);
      reconcile(response.data.shell);
    });
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
        title="Operations Complete"
        lines={lines}
        actions={[
          {
            label: 'Run Again',
            primary: true,
            icon: 'produce',
            onClick: () => setResult(null),
          },
        ]}
        secondaryActions={PRODUCE_RESULT_SECONDARY_ACTIONS}
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

  const resourceLabelText = formatResourceLabel(drugType);

  return (
    <div className="g-scout-page" aria-busy={pending || undefined}>
      <div className="g-scout-areas" role="listbox" aria-label="Technology type">
        {OPERATION_RESOURCES.map((resource) => (
          <OperationsResourceCard
            key={resource.key}
            label={resource.label}
            hint={resource.hint}
            selected={drugType === resource.key}
            disabled={pending}
            onSelect={() => setDrugType(resource.key)}
          />
        ))}
      </div>

      <div className="g-scout-action-panel g-gameplay-controls">
        <div className="g-scout-turns-header">
          <div className="g-scout-turns-header__main">
            <span className="g-scout-turns-header__label">Turns to spend</span>
            <TurnQuickAmounts
              value={amount}
              onSelect={selectQuickAmount}
              disabled={pending}
              middleSlot={
                <NumericInput
                  id="produce-turns"
                  label="Turns to run"
                  value={amountRaw}
                  onChange={handleAmountChange}
                  suffix="turns"
                  className="g-scout-custom-turns g-turn-spend-input"
                  disabled={pending}
                />
              }
            />
          </div>
          <div className="g-scout-turns-header__count" aria-label={`${turns.toLocaleString()} turns available`}>
            <span className="g-scout-turns-header__value">{turns.toLocaleString()}</span>
            <span className="g-scout-turns-header__sub">available</span>
          </div>
        </div>

        {effectiveThugs === 0 ? (
          <p className="g-scout-alert g-scout-alert--critical" role="alert">
            Need {OS_TERMS.enforcers.toLowerCase()}?{' '}
            <Link href="/scout" className="g-link-inline">
              Scout to recruit
            </Link>
          </p>
        ) : drugLabBonus > 0 ? (
          <p className="g-scout-network-chip">
            <span className="g-scout-network-chip__label">Workshops</span>
            <span className="g-scout-network-chip__value">
              +{Math.round(drugLabBonus * 100)}% output bonus
            </span>
          </p>
        ) : (
          <p className="g-scout-network-chip g-scout-network-chip--muted">
            <span className="g-scout-network-chip__label">Output</span>
            <span className="g-scout-network-chip__value">Street operation</span>
          </p>
        )}

        {preview && preview.drugMax > 0 ? (
          <p className="g-scout-network-chip">
            <span className="g-scout-network-chip__label">Estimate</span>
            <span className="g-scout-network-chip__value">
              {preview.drugMin.toLocaleString()}–{preview.drugMax.toLocaleString()} {resourceLabelText}
              {preview.playerCash > 0 ? ` · ~$${preview.playerCash.toLocaleString()} cash` : ''}
            </span>
          </p>
        ) : null}

        {walkout.level !== 'none' ? (
          <p className={`g-scout-alert${walkout.level === 'critical' ? ' g-scout-alert--critical' : ''}`} role="alert">
            {walkout.level === 'critical' ? 'Low morale — ' : ''}
            {walkout.message}
          </p>
        ) : null}

        {error ? <p className="g-error">{error}</p> : null}

        <PrimaryButton
          className="g-btn-full g-scout-submit"
          icon="produce"
          onClick={handleProduce}
          disabled={pending || effectiveThugs === 0}
          pending={pending}
        >
          {pending
            ? ACTION_PENDING.produce
            : `Run ${resourceLabelText} · ${amount.toLocaleString()} turn${amount === 1 ? '' : 's'}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
