'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import { useMutationLock } from '@local/hooks/useMutationLock';
import { scoutAction, type OldSkoolScoutResult } from '@local/server/actions/scout.actions';
import { getScoutAreaDisplays } from '@core/lib/game-engine/scout-display';
import { assessScoutWalkoutRisk } from '@core/lib/game-engine/happiness';
import type { RedliteScoutAreaSlug } from '@core/config/game/redlite-rules';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { TurnQuickAmounts } from '@local/components/game/TurnQuickAmounts';
import { ActionResult, type ActionResultLine } from '@local/components/game/ActionResult';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { workersLabel, thugsLabel, OS_TERMS } from '@local/config/terminology';
import { buildStreetIncomeBreakdownLines } from '@local/lib/income-breakdown';
import { buildSupplyImpactLines } from '@local/lib/supply-result-lines';
import { SCOUT_RESULT_SECONDARY_ACTIONS } from '@local/lib/scout-result-actions';
import { formatRecruitmentBonusDisplay } from '@core/config/game/business-recruitment-rules';
import type { EmpireRecruitmentMultipliers } from '@core/config/game/empire-recruitment-rules';
import { isRetryableGameplayConflict } from '@core/lib/db/serializable-transaction';
import { ScoutAreaCard } from '@local/features/scout/ScoutAreaCard';

interface ScoutFormProps {
  districtSlug: string;
  initialTurns: number;
  prostituteHappiness: number;
  thugHappiness: number;
  prostituteCount: number;
  thugCount: number;
  prefilledTurns?: number;
  prefilledArea?: RedliteScoutAreaSlug;
  empireRecruitment?: EmpireRecruitmentMultipliers | null;
}

export function ScoutForm({
  districtSlug,
  initialTurns,
  prostituteHappiness,
  thugHappiness,
  prostituteCount,
  thugCount,
  prefilledTurns,
  prefilledArea,
  empireRecruitment,
}: ScoutFormProps) {
  const reconcile = useGameplayReconcile();
  const { locked: pending, run } = useMutationLock();
  const areaDisplays = getScoutAreaDisplays(districtSlug);
  const defaultTurns = prefilledTurns ?? 25;
  const defaultArea =
    prefilledArea && areaDisplays.some((a) => a.slug === prefilledArea)
      ? prefilledArea
      : ('streets' as RedliteScoutAreaSlug);
  const [turns, setTurns] = useState(initialTurns);
  const [amountRaw, setAmountRaw] = useState(String(defaultTurns));
  const [amount, setAmount] = useState(defaultTurns);
  const [areaSlug, setAreaSlug] = useState<RedliteScoutAreaSlug>(defaultArea);
  const selectedArea = areaDisplays.find((area) => area.slug === areaSlug);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OldSkoolScoutResult | null>(null);

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

  async function handleScout() {
    const validationError = validateTurnAmount(amount > 0 ? amount : null, turns);
    if (validationError) {
      setError(validationError);
      return;
    }
    await run('scout', async () => {
      setError('');
      const idempotencyKey = uuidv4();
      let response = await scoutAction(amount, idempotencyKey, areaSlug);
      if (!response.success && isRetryableGameplayConflict(response.error)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        response = await scoutAction(amount, idempotencyKey, areaSlug);
      }
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
      { text: `+${result.prostitutesFound} ${workersLabel(result.prostitutesFound)}`, tone: 'positive' },
      { text: `+${result.thugsFound} ${thugsLabel(result.thugsFound)}`, tone: 'positive' },
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
    if (result.empireRecruitmentStrength) {
      lines.push({
        text: `Recruitment network: ${result.empireRecruitmentStrength}`,
        tone: 'positive',
      });
    }
    if ((result.businessNetworkWorkerBonusPercent ?? 0) > 0) {
      lines.push({
        text: `Business bonus: ${formatRecruitmentBonusDisplay(result.businessNetworkWorkerBonusPercent!)} ${OS_TERMS.specialists}`,
        tone: 'positive',
      });
    }
    if ((result.businessNetworkThugBonusPercent ?? 0) > 0) {
      lines.push({
        text: `Business bonus: ${formatRecruitmentBonusDisplay(result.businessNetworkThugBonusPercent!)} ${OS_TERMS.enforcers}`,
        tone: 'positive',
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
        secondaryActions={SCOUT_RESULT_SECONDARY_ACTIONS}
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
    <div className="g-scout-page" aria-busy={pending || undefined}>
      <div className="g-scout-areas" role="listbox" aria-label="Scout areas">
        {areaDisplays.map((area) => (
          <ScoutAreaCard
            key={area.slug}
            area={area}
            selected={areaSlug === area.slug}
            disabled={pending}
            onSelect={() => setAreaSlug(area.slug as RedliteScoutAreaSlug)}
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
                  id="scout-turns"
                  label="Turns to scout"
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

        {empireRecruitment ? (
          <p className="g-scout-network-chip">
            <span className="g-scout-network-chip__label">Network</span>
            <span className="g-scout-network-chip__value">{empireRecruitment.strengthLabel}</span>
            {(empireRecruitment.workerBonusPercent > 0 || empireRecruitment.thugBonusPercent > 0) && (
              <span className="g-scout-network-chip__bonus">
                {empireRecruitment.workerBonusPercent > 0
                  ? `${OS_TERMS.specialists} ${formatRecruitmentBonusDisplay(empireRecruitment.workerBonusPercent)}`
                  : null}
                {empireRecruitment.workerBonusPercent > 0 && empireRecruitment.thugBonusPercent > 0
                  ? ' · '
                  : null}
                {empireRecruitment.thugBonusPercent > 0
                  ? `${OS_TERMS.enforcers} ${formatRecruitmentBonusDisplay(empireRecruitment.thugBonusPercent)}`
                  : null}
              </span>
            )}
          </p>
        ) : (
          <p className="g-scout-network-chip g-scout-network-chip--muted">
            <span className="g-scout-network-chip__label">Network</span>
            <span className="g-scout-network-chip__value">
              Street only —{' '}
              <a href="/businesses" className="g-link-inline">
                expand empire
              </a>
            </span>
          </p>
        )}

        {walkout.level !== 'none' ? (
          <p className={`g-scout-alert${walkout.level === 'critical' ? ' g-scout-alert--critical' : ''}`} role="alert">
            {walkout.level === 'critical' ? 'Low morale — ' : ''}
            {walkout.message}
          </p>
        ) : null}

        {error ? <p className="g-error">{error}</p> : null}

        <PrimaryButton
          className="g-btn-full g-scout-submit"
          icon="scout"
          onClick={handleScout}
          disabled={pending}
          pending={pending}
        >
          {pending
            ? ACTION_PENDING.scout
            : `Scout ${selectedArea?.name ?? 'Area'} · ${amount.toLocaleString()} turn${amount === 1 ? '' : 's'}`}
        </PrimaryButton>
      </div>
    </div>
  );
}
