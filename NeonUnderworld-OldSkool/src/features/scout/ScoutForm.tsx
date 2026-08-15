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
import { SelectableCard } from '@local/components/game/SelectableCard';
import { TurnQuickAmounts } from '@local/components/game/TurnQuickAmounts';
import { ActionResult, type ActionResultLine } from '@local/components/game/ActionResult';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { validateTurnAmount } from '@local/lib/numeric-input';
import { workersLabel, thugsLabel } from '@local/config/terminology';
import { buildStreetIncomeBreakdownLines } from '@local/lib/income-breakdown';
import { buildSupplyImpactLines } from '@local/lib/supply-result-lines';
import { SCOUT_RESULT_SECONDARY_ACTIONS } from '@local/lib/scout-result-actions';
import { formatRecruitmentBonusDisplay } from '@core/config/game/business-recruitment-rules';
import type { EmpireRecruitmentMultipliers } from '@core/config/game/empire-recruitment-rules';
import { isRetryableGameplayConflict } from '@core/lib/db/serializable-transaction';

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
        text: `Business bonus: ${formatRecruitmentBonusDisplay(result.businessNetworkWorkerBonusPercent!)} Workers`,
        tone: 'positive',
      });
    }
    if ((result.businessNetworkThugBonusPercent ?? 0) > 0) {
      lines.push({
        text: `Business bonus: ${formatRecruitmentBonusDisplay(result.businessNetworkThugBonusPercent!)} Thugs`,
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

  return (
    <div aria-busy={pending || undefined}>
      <div role="listbox" aria-label="Scout areas">
        {areaDisplays.map((area) => (
          <SelectableCard
            key={area.slug}
            title={area.name}
            meta={`Workers: ${area.workers} · Thugs: ${area.thugs} · Risk: ${area.risk}`}
            selected={areaSlug === area.slug}
            disabled={pending}
            onClick={() => setAreaSlug(area.slug as RedliteScoutAreaSlug)}
          >
            <p className="g-area-tagline">{area.tagline}</p>
          </SelectableCard>
        ))}
      </div>

      <TurnQuickAmounts value={amount} onSelect={selectQuickAmount} disabled={pending} />

      <NumericInput
        id="scout-turns"
        label="Turns to scout"
        value={amountRaw}
        onChange={handleAmountChange}
        suffix="turns"
        disabled={pending}
      />

      <p className="g-note">Supplies help keep your crew loyal and effective.</p>

      {empireRecruitment ? (
        <p className="g-scout-network g-note">
          <strong>Recruitment Network</strong> — {empireRecruitment.strengthLabel}
          {(empireRecruitment.workerBonusPercent > 0 || empireRecruitment.thugBonusPercent > 0) && (
            <>
              {' '}
              · Workers {formatRecruitmentBonusDisplay(empireRecruitment.workerBonusPercent)} · Thugs{' '}
              {formatRecruitmentBonusDisplay(empireRecruitment.thugBonusPercent)}
            </>
          )}
        </p>
      ) : (
        <p className="g-scout-network g-note">
          <strong>Recruitment Network:</strong> Street operation —{' '}
          <a href="/businesses" className="g-link-inline">
            expand your empire
          </a>{' '}
          to recruit faster.
        </p>
      )}

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

      <PrimaryButton
        className="g-btn-full"
        icon="scout"
        onClick={handleScout}
        disabled={pending}
        pending={pending}
      >
        {pending ? ACTION_PENDING.scout : `Scout ${selectedArea?.name ?? 'Area'}?`}
      </PrimaryButton>
    </div>
  );
}
