'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BusinessType } from '@prisma/client';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import {
  assignBusinessWorkersAction,
  collectBusinessSafeAction,
  purchaseBusinessAction,
  removeBusinessWorkersAction,
  storeBusinessDrugsAction,
  withdrawBusinessDrugsAction,
  type BusinessesPageData,
} from '@local/server/actions/business.actions';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { StatRow } from '@local/components/game/StatRow';
import { SectionLabel } from '@local/components/game/SectionLabel';
import { Divider } from '@local/components/game/Divider';
import { parsePositiveInteger, validateQuantity } from '@local/lib/numeric-input';

function fmtCash(n: number): string {
  return `$${n.toLocaleString()}`;
}

type Props = {
  initialData: BusinessesPageData;
};

const DRUG_LABELS: Record<string, string> = {
  hash: 'Hash',
  shrooms: 'Shrooms',
  coke: 'Coke',
  heroin: 'Heroin',
};

function heatClass(band: string): string {
  if (band === 'CRITICAL') return 'g-status-critical';
  if (band === 'HIGH') return 'g-status-warn';
  if (band === 'MODERATE') return 'g-status-caution';
  return 'g-status-ok';
}

export function BusinessesPanel({ initialData }: Props) {
  const reconcile = useGameplayReconcile();
  const [data, setData] = useState(initialData);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialData.businesses[0]?.id ?? null,
  );
  const [workerQty, setWorkerQty] = useState<Record<string, string>>({});
  const [drugQty, setDrugQty] = useState<Record<string, string>>({});
  const [drugType, setDrugType] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function applyShell(result: { shell?: unknown; canonicalNetWorth: number; newCash: number; streetWorkers?: number }) {
    if ('shell' in result && result.shell) {
      reconcile(result.shell as Parameters<typeof reconcile>[0]);
    }
    setData((prev) => ({
      ...prev,
      cash: result.newCash,
      canonicalNetWorth: result.canonicalNetWorth,
      streetWorkers: result.streetWorkers ?? prev.streetWorkers,
    }));
  }

  async function runPurchase(type: BusinessType) {
    setLoading(`buy-${type}`);
    setError('');
    setMessage('');
    const response = await purchaseBusinessAction(type, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    window.location.reload();
  }

  async function runCollect(businessId: string) {
    setLoading(`collect-${businessId}`);
    setError('');
    const response = await collectBusinessSafeAction(businessId, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    setMessage(`Collected $${response.data.collected.toLocaleString()}.`);
    window.location.reload();
  }

  async function runWorkers(businessId: string, mode: 'assign' | 'remove') {
    const qty = parsePositiveInteger(workerQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-${businessId}`);
    setError('');
    const action = mode === 'assign' ? assignBusinessWorkersAction : removeBusinessWorkersAction;
    const response = await action(businessId, qty!, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    window.location.reload();
  }

  async function runDrug(businessId: string, mode: 'store' | 'withdraw') {
    const drug = drugType[businessId] ?? 'hash';
    const qty = parsePositiveInteger(drugQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-${businessId}-${drug}`);
    setError('');
    const action = mode === 'store' ? storeBusinessDrugsAction : withdrawBusinessDrugsAction;
    const response = await action(businessId, drug, qty!, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    window.location.reload();
  }

  return (
    <>
      <SectionLabel>SUMMARY</SectionLabel>
      <StatRow label="Owned" value={data.summary.ownedCount.toLocaleString()} />
      <StatRow
        label="Workers"
        value={`Street ${data.summary.streetWorkers.toLocaleString()} · Assigned ${data.summary.assignedWorkers.toLocaleString()}`}
      />
      <StatRow label="Business Safe" value={fmtCash(data.summary.totalSafeCash)} />
      <StatRow label="Stored Drugs" value={`${data.summary.totalStoredDrugs.toLocaleString()} units`} />
      <StatRow
        label="Overall Heat"
        value={<span className={heatClass(data.summary.overallHeatBand)}>{data.summary.overallHeatBand}</span>}
      />

      <Divider />

      {data.businesses.map((biz) => {
        const expanded = expandedId === biz.id;
        return (
          <div key={biz.id} className="g-card g-stack-sm" style={{ marginBottom: '1rem' }}>
            <button
              type="button"
              className="g-card-header-btn"
              onClick={() => setExpandedId(expanded ? null : biz.id)}
            >
              <strong>{biz.name}</strong>
              <span className="g-muted">
                {biz.displayName} · {biz.districtName}
              </span>
            </button>

            <StatRow label="Workers" value={biz.assignedWorkers.toLocaleString()} />
            <StatRow label="Income" value={`${fmtCash(biz.hourlyIncome)}/hr`} />
            <StatRow
              label="Safe"
              value={`${fmtCash(biz.safeCash)} / ${fmtCash(biz.safeCapacity)}${biz.safeFull ? ' · SAFE FULL' : ''}`}
            />
            <StatRow label="Stored" value={`${biz.storedDrugUnits.toLocaleString()} / ${biz.drugStorageCapacity.toLocaleString()}`} />
            <StatRow
              label="Heat"
              value={<span className={heatClass(biz.heatBand)}>{biz.heatLabel}</span>}
            />

            {!expanded ? (
              <PrimaryButton type="button" variant="secondary" onClick={() => setExpandedId(biz.id)}>
                Manage
              </PrimaryButton>
            ) : (
              <>
                <Divider />
                <SectionLabel>WORKERS</SectionLabel>
                <StatRow label="Street available" value={data.streetWorkers.toLocaleString()} />
                <StatRow label="Assigned here" value={biz.assignedWorkers.toLocaleString()} />
                <NumericInput
                  id={`workers-${biz.id}`}
                  label="Quantity"
                  value={workerQty[biz.id] ?? '1'}
                  onChange={(v) => setWorkerQty((prev) => ({ ...prev, [biz.id]: v }))}
                />
                <div className="g-btn-row">
                  <PrimaryButton
                    type="button"
                    pending={loading === `assign-${biz.id}`}
                    onClick={() => runWorkers(biz.id, 'assign')}
                  >
                    Assign
                  </PrimaryButton>
                  <PrimaryButton
                    type="button"
                    variant="secondary"
                    pending={loading === `remove-${biz.id}`}
                    onClick={() => runWorkers(biz.id, 'remove')}
                  >
                    Remove
                  </PrimaryButton>
                </div>

                <Divider />
                <SectionLabel>SAFE</SectionLabel>
                <PrimaryButton
                  type="button"
                  pending={loading === `collect-${biz.id}`}
                  disabled={biz.safeCash <= 0}
                  onClick={() => runCollect(biz.id)}
                >
                  Collect
                </PrimaryButton>

                <Divider />
                <SectionLabel>DRUG STORAGE</SectionLabel>
                {(['hash', 'shrooms', 'coke', 'heroin'] as const).map((key) => (
                  <StatRow
                    key={key}
                    label={DRUG_LABELS[key]}
                    value={`Street ${data.streetDrugs[key].toLocaleString()} · Stored ${biz.storedDrugs[key].toLocaleString()}`}
                  />
                ))}
                <label className="g-field-label">
                  Drug
                  <select
                    className="g-input"
                    value={drugType[biz.id] ?? 'hash'}
                    onChange={(e) => setDrugType((prev) => ({ ...prev, [biz.id]: e.target.value }))}
                  >
                    {(['hash', 'shrooms', 'coke', 'heroin'] as const).map((key) => (
                      <option key={key} value={key}>
                        {DRUG_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </label>
                <NumericInput
                  id={`drugs-${biz.id}`}
                  label="Quantity"
                  value={drugQty[biz.id] ?? '1'}
                  onChange={(v) => setDrugQty((prev) => ({ ...prev, [biz.id]: v }))}
                />
                <div className="g-btn-row">
                  <PrimaryButton
                    type="button"
                    pending={loading === `store-${biz.id}-${drugType[biz.id] ?? 'hash'}`}
                    onClick={() => runDrug(biz.id, 'store')}
                  >
                    Store
                  </PrimaryButton>
                  <PrimaryButton
                    type="button"
                    variant="secondary"
                    pending={loading === `withdraw-${biz.id}-${drugType[biz.id] ?? 'hash'}`}
                    onClick={() => runDrug(biz.id, 'withdraw')}
                  >
                    Withdraw
                  </PrimaryButton>
                </div>
              </>
            )}
          </div>
        );
      })}

      <Divider />
      <SectionLabel>ACQUIRE BUSINESS</SectionLabel>
      <StatRow label="Your cash" value={fmtCash(data.cash)} />
      {data.catalog.map((entry) => (
        <div key={entry.type} className="g-card g-stack-sm" style={{ marginBottom: '0.75rem' }}>
          <strong>{entry.displayName}</strong>
          <span className="g-muted">{entry.blurb}</span>
          <StatRow label="Price" value={fmtCash(entry.purchasePrice)} />
          <StatRow label="Street NW" value={fmtCash(entry.streetNwContribution)} />
          <StatRow label="Safe cap" value={fmtCash(entry.safeCapacity)} />
          <StatRow label="Drug storage" value={`${entry.drugStorageCapacity.toLocaleString()} units`} />
          <PrimaryButton
            type="button"
            pending={loading === `buy-${entry.type}`}
            disabled={!data.canPurchase || data.cash < entry.purchasePrice}
            onClick={() => runPurchase(entry.type)}
          >
            Acquire {entry.displayName}
          </PrimaryButton>
        </div>
      ))}

      {error ? <p className="g-error">{error}</p> : null}
      {message ? <p className="g-note">{message}</p> : null}
    </>
  );
}
