'use client';

import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { BusinessType } from '@prisma/client';
import {
  businessHourlyIncome,
  getBusinessLevelStats,
  MAX_BUSINESSES_PER_PLAYER,
} from '@core/config/game/business-rules';
import { useGameplayReconcile } from '@local/hooks/useGameplayReconcile';
import {
  assignBusinessWorkersAction,
  assignBusinessSecurityAction,
  collectBusinessSafeAction,
  purchaseBusinessAction,
  refreshBusinessesPageDataAction,
  removeBusinessWorkersAction,
  removeBusinessSecurityAction,
  storeBusinessDrugsAction,
  upgradeBusinessAction,
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

type DrugKey = 'hash' | 'shrooms' | 'coke' | 'heroin';
type ViewId = string;

const DRUG_LABELS: Record<DrugKey, string> = {
  hash: 'Hash',
  shrooms: 'Shrooms',
  coke: 'Coke',
  heroin: 'Heroin',
};

const ACQUIRE_VIEW = 'acquire';

function heatClass(band: string): string {
  if (band === 'CRITICAL') return 'g-status-critical';
  if (band === 'HIGH') return 'g-status-warn';
  if (band === 'MODERATE') return 'g-status-caution';
  return 'g-status-ok';
}

function securityLabel(band: string): string {
  return band.charAt(0) + band.slice(1).toLowerCase();
}

function incomeLabel(type: BusinessType): string {
  if (type === 'NIGHTCLUB') return 'High';
  if (type === 'DRUG_LAB') return 'Moderate';
  return 'Low';
}

function heatDescriptor(baseHeat: number): string {
  if (baseHeat >= 30) return 'High';
  if (baseHeat >= 15) return 'Moderate';
  return 'Low';
}

function defaultView(data: BusinessesPageData): ViewId {
  return data.businesses[0]?.id ?? ACQUIRE_VIEW;
}

function patchWorkerState(
  prev: BusinessesPageData,
  businessId: string,
  assignedWorkers: number,
  streetWorkers: number,
  level: number,
  businessType: BusinessType,
): BusinessesPageData {
  const businesses = prev.businesses.map((b) =>
    b.id === businessId
      ? {
          ...b,
          assignedWorkers,
          hourlyIncome: businessHourlyIncome(businessType, assignedWorkers, level),
        }
      : b,
  );
  return {
    ...prev,
    streetWorkers,
    businesses,
    summary: {
      ...prev.summary,
      streetWorkers,
      assignedWorkers: businesses.reduce((sum, b) => sum + b.assignedWorkers, 0),
    },
  };
}

function patchCollectState(
  prev: BusinessesPageData,
  businessId: string,
  newCash: number,
): BusinessesPageData {
  const businesses = prev.businesses.map((b) =>
    b.id === businessId ? { ...b, safeCash: 0, safeFull: false } : b,
  );
  return {
    ...prev,
    cash: newCash,
    businesses,
    summary: {
      ...prev.summary,
      totalSafeCash: businesses.reduce((sum, b) => sum + b.safeCash, 0),
    },
  };
}

function patchDrugState(
  prev: BusinessesPageData,
  businessId: string,
  drug: DrugKey,
  quantity: number,
  mode: 'store' | 'withdraw',
): BusinessesPageData {
  const businessDelta = mode === 'store' ? quantity : -quantity;
  const streetDelta = mode === 'store' ? -quantity : quantity;
  const businesses = prev.businesses.map((b) => {
    if (b.id !== businessId) return b;
    const storedDrugs = { ...b.storedDrugs, [drug]: b.storedDrugs[drug] + businessDelta };
    return {
      ...b,
      storedDrugs,
      storedDrugUnits: b.storedDrugUnits + businessDelta,
    };
  });
  const streetDrugs = { ...prev.streetDrugs, [drug]: prev.streetDrugs[drug] + streetDelta };
  return {
    ...prev,
    streetDrugs,
    businesses,
    summary: {
      ...prev.summary,
      totalStoredDrugs: businesses.reduce((sum, b) => sum + b.storedDrugUnits, 0),
    },
  };
}

function patchSecurityState(
  prev: BusinessesPageData,
  businessId: string,
  assignedThugs: number,
  streetThugs: number,
): BusinessesPageData {
  const businesses = prev.businesses.map((b) =>
    b.id === businessId ? { ...b, assignedThugs } : b,
  );
  return { ...prev, streetThugs, businesses };
}

export function BusinessesPanel({ initialData }: Props) {
  const reconcile = useGameplayReconcile();
  const [data, setData] = useState(initialData);
  const [activeView, setActiveView] = useState<ViewId>(() => defaultView(initialData));
  const [workerQty, setWorkerQty] = useState<Record<string, string>>({});
  const [thugQty, setThugQty] = useState<Record<string, string>>({});
  const [drugQty, setDrugQty] = useState<Record<string, string>>({});
  const [drugType, setDrugType] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (activeView === ACQUIRE_VIEW) return;
    if (!data.businesses.some((b) => b.id === activeView)) {
      setActiveView(defaultView(data));
    }
  }, [data.businesses, activeView]);

  const activeBusiness =
    activeView === ACQUIRE_VIEW
      ? null
      : data.businesses.find((b) => b.id === activeView) ?? null;

  function applyShell(result: {
    shell?: unknown;
    canonicalNetWorth: number;
    newCash: number;
    streetWorkers?: number;
    streetThugs?: number;
  }) {
    if ('shell' in result && result.shell) {
      reconcile(result.shell as Parameters<typeof reconcile>[0]);
    }
    setData((prev) => ({
      ...prev,
      cash: result.newCash,
      canonicalNetWorth: result.canonicalNetWorth,
      streetWorkers: result.streetWorkers ?? prev.streetWorkers,
      streetThugs: result.streetThugs ?? prev.streetThugs,
    }));
  }

  async function reloadPageData(preferredView?: ViewId) {
    const response = await refreshBusinessesPageDataAction();
    if (!response.success) {
      setError(response.error);
      return false;
    }
    setData(response.data);
    setActiveView(preferredView ?? defaultView(response.data));
    return true;
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
    applyShell(response.data);
    const ok = await reloadPageData(response.data.businessId);
    if (ok) {
      setMessage(`Acquired ${response.data.businessName} for ${fmtCash(response.data.purchasePrice)}.`);
    }
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
    setData((prev) => patchCollectState(prev, businessId, response.data.newCash));
    setMessage(`Collected $${response.data.collected.toLocaleString()}.`);
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
    setMessage('');
    const action = mode === 'assign' ? assignBusinessWorkersAction : removeBusinessWorkersAction;
    const response = await action(businessId, qty!, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    const biz = data.businesses.find((b) => b.id === businessId);
    setData((prev) =>
      patchWorkerState(
        prev,
        businessId,
        response.data.assignedWorkers,
        response.data.streetWorkers,
        biz?.level ?? 1,
        biz?.businessType ?? 'NIGHTCLUB',
      ),
    );
    setMessage(
      mode === 'assign'
        ? `Assigned ${qty!.toLocaleString()} Worker${qty === 1 ? '' : 's'}.`
        : `Removed ${qty!.toLocaleString()} Worker${qty === 1 ? '' : 's'}.`,
    );
  }

  async function runSecurity(businessId: string, mode: 'assign' | 'remove') {
    const qty = parsePositiveInteger(thugQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-sec-${businessId}`);
    setError('');
    setMessage('');
    const action = mode === 'assign' ? assignBusinessSecurityAction : removeBusinessSecurityAction;
    const response = await action(businessId, qty!, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    setData((prev) =>
      patchSecurityState(prev, businessId, response.data.assignedThugs, response.data.streetThugs),
    );
    setMessage(
      mode === 'assign'
        ? `Assigned ${qty!.toLocaleString()} Thug${qty === 1 ? '' : 's'} to security.`
        : `Removed ${qty!.toLocaleString()} Thug${qty === 1 ? '' : 's'} from security.`,
    );
  }

  async function runUpgrade(businessId: string) {
    setLoading(`upgrade-${businessId}`);
    setError('');
    setMessage('');
    const response = await upgradeBusinessAction(businessId, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    await reloadPageData(businessId);
    setMessage(`Upgraded to Level ${response.data.level}.`);
  }

  async function runDrug(businessId: string, mode: 'store' | 'withdraw') {
    const drug = (drugType[businessId] ?? 'hash') as DrugKey;
    const qty = parsePositiveInteger(drugQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-${businessId}-${drug}`);
    setError('');
    setMessage('');
    const action = mode === 'store' ? storeBusinessDrugsAction : withdrawBusinessDrugsAction;
    const response = await action(businessId, drug, qty!, uuidv4());
    setLoading(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    applyShell(response.data);
    setData((prev) => patchDrugState(prev, businessId, drug, qty!, mode));
    setMessage(
      mode === 'store'
        ? `Stored ${qty!.toLocaleString()} ${DRUG_LABELS[drug]}.`
        : `Withdrew ${qty!.toLocaleString()} ${DRUG_LABELS[drug]}.`,
    );
  }

  function renderUpgradeSection(biz: BusinessesPageData['businesses'][number]) {
    if (!biz.nextUpgradeLevel || biz.nextUpgradeCost == null) return null;
    const current = getBusinessLevelStats(biz.businessType, biz.level);
    const next = getBusinessLevelStats(biz.businessType, biz.nextUpgradeLevel);

    return (
      <>
        <Divider />
        <SectionLabel>NEXT UPGRADE</SectionLabel>
        <StatRow label="Level" value={`${biz.nextUpgradeLevel}`} />
        <StatRow label="Cost" value={fmtCash(biz.nextUpgradeCost)} />
        <p className="g-business-limits">Unlocks / improves:</p>
        <StatRow
          label="Workers"
          value={`${current.workerCapacity.toLocaleString()} → ${next.workerCapacity.toLocaleString()}`}
        />
        <StatRow
          label="Safe"
          value={`${fmtCash(current.safeCapacity)} → ${fmtCash(next.safeCapacity)}`}
        />
        <StatRow
          label="Storage"
          value={`${current.drugStorageCapacity.toLocaleString()} → ${next.drugStorageCapacity.toLocaleString()}`}
        />
        <StatRow
          label="Security"
          value={`${current.securityCapacity} → ${next.securityCapacity}`}
        />
        <PrimaryButton
          type="button"
          pending={loading === `upgrade-${biz.id}`}
          disabled={data.cash < biz.nextUpgradeCost}
          onClick={() => runUpgrade(biz.id)}
        >
          Upgrade to Level {biz.nextUpgradeLevel}
        </PrimaryButton>
        <p className="g-business-limits">
          Upgrade Businesses to increase capacity and unlock stronger benefits.
        </p>
      </>
    );
  }

  function renderBusinessManage(biz: BusinessesPageData['businesses'][number]) {
    const workerCapLabel = biz.workerOverCapacity
      ? `${biz.assignedWorkers.toLocaleString()} / ${biz.workerCapacity.toLocaleString()} · OVER CAPACITY`
      : `${biz.assignedWorkers.toLocaleString()} / ${biz.workerCapacity.toLocaleString()}`;

    const securityCapLabel = biz.securityOverCapacity
      ? `${biz.assignedThugs} / ${biz.securityCapacity} · OVER CAPACITY`
      : `${biz.assignedThugs} / ${biz.securityCapacity}`;

    return (
      <div className="g-business-panel">
        <div className="g-business-panel-head">
          <h3 className="g-business-panel-title">{biz.name}</h3>
          <p className="g-business-panel-blurb">
            {biz.displayName.toUpperCase()} · LEVEL {biz.level} · {biz.districtName}
          </p>
        </div>

        <StatRow label="Workers" value={workerCapLabel} />
        <StatRow label="Security" value={securityCapLabel} />
        <StatRow
          label="Safe"
          value={`${fmtCash(biz.safeCash)} / ${fmtCash(biz.safeCapacity)}${biz.safeFull ? ' · SAFE FULL — income paused' : ''}`}
        />
        <StatRow
          label="Storage"
          value={`${biz.storedDrugUnits.toLocaleString()} / ${biz.drugStorageCapacity.toLocaleString()}`}
        />
        <StatRow label="Income" value={`${fmtCash(biz.hourlyIncome)}/hr`} />
        <StatRow
          label="Heat"
          value={<span className={heatClass(biz.heatBand)}>{biz.heatLabel}</span>}
        />

        <Divider />
        <SectionLabel>WORKERS</SectionLabel>
        <p className="g-business-limits">
          Assigned Workers earn passive income but are unavailable for Street work.
        </p>
        <StatRow label="Street available" value={data.streetWorkers.toLocaleString()} />
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
            disabled={biz.workerOverCapacity || biz.assignedWorkers >= biz.workerCapacity}
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
        <SectionLabel>SECURITY</SectionLabel>
        <p className="g-business-limits">
          Assigned Thugs protect this Business but cannot attack or defend your Street operation.
        </p>
        <StatRow label="Street Thugs available" value={data.streetThugs.toLocaleString()} />
        <StatRow label="Protection" value={securityLabel(biz.securityBand)} />
        <StatRow label="Coverage" value={`${Math.round(biz.securityCoverage * 100)}%`} />
        <NumericInput
          id={`security-${biz.id}`}
          label="Quantity"
          value={thugQty[biz.id] ?? '1'}
          onChange={(v) => setThugQty((prev) => ({ ...prev, [biz.id]: v }))}
        />
        <div className="g-btn-row">
          <PrimaryButton
            type="button"
            pending={loading === `assign-sec-${biz.id}`}
            disabled={biz.securityOverCapacity || biz.assignedThugs >= biz.securityCapacity}
            onClick={() => runSecurity(biz.id, 'assign')}
          >
            Assign Security
          </PrimaryButton>
          <PrimaryButton
            type="button"
            variant="secondary"
            pending={loading === `remove-sec-${biz.id}`}
            onClick={() => runSecurity(biz.id, 'remove')}
          >
            Remove
          </PrimaryButton>
        </div>

        <Divider />
        <SectionLabel>SAFE</SectionLabel>
        <p className="g-business-limits">
          Business income stays outside Street Net Worth until collected.
        </p>
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
        <p className="g-business-limits">
          Stored drugs are hidden from Street Net Worth but increase Police Heat.
        </p>
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

        {renderUpgradeSection(biz)}
      </div>
    );
  }

  function renderAcquire() {
    return (
      <>
        <SectionLabel>ACQUIRE BUSINESS</SectionLabel>
        <StatRow label="Your cash" value={fmtCash(data.cash)} />
        <StatRow
          label="Owned"
          value={`${data.summary.ownedCount.toLocaleString()} / ${MAX_BUSINESSES_PER_PLAYER}`}
        />
        <p className="g-business-limits">
          You can own up to {MAX_BUSINESSES_PER_PLAYER} businesses total. Each site is upgradeable to
          Level 5.
        </p>
        {data.catalog.map((entry) => (
          <div key={entry.type} className="g-business-panel">
            <div className="g-business-panel-head">
              <h3 className="g-business-panel-title">{entry.displayName.toUpperCase()}</h3>
              <p className="g-business-panel-blurb">{entry.blurb}</p>
            </div>
            <StatRow label="Price" value={fmtCash(entry.purchasePrice)} />
            <StatRow label="Workers" value={`${entry.workerCapacity.toLocaleString()} max`} />
            <StatRow label="Safe" value={fmtCash(entry.safeCapacity)} />
            <StatRow label="Storage" value={`${entry.drugStorageCapacity.toLocaleString()} units`} />
            <StatRow label="Income" value={incomeLabel(entry.type)} />
            <StatRow label="Heat" value={heatDescriptor(entry.baseHeat)} />
            <StatRow label="Street NW" value={fmtCash(entry.streetNwContribution)} />
            <div className="g-business-panel-actions">
              <PrimaryButton
                type="button"
                pending={loading === `buy-${entry.type}`}
                disabled={!data.canPurchase || data.cash < entry.purchasePrice}
                onClick={() => runPurchase(entry.type)}
              >
                Buy
              </PrimaryButton>
            </div>
          </div>
        ))}
      </>
    );
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
      <StatRow label="Portfolio Investment" value={fmtCash(data.summary.totalInvested)} />
      <StatRow label="Business Asset NW" value={fmtCash(data.summary.businessStreetAssets)} />
      <StatRow
        label="Overall Heat"
        value={<span className={heatClass(data.summary.overallHeatBand)}>{data.summary.overallHeatBand}</span>}
      />

      <Divider />

      <div className="g-business-tabs" role="tablist" aria-label="Your businesses">
        {data.businesses.map((biz) => (
          <button
            key={biz.id}
            type="button"
            role="tab"
            aria-selected={activeView === biz.id}
            className={`g-business-tab${activeView === biz.id ? ' g-business-tab-active' : ''}`}
            onClick={() => {
              setActiveView(biz.id);
              setError('');
              setMessage('');
            }}
          >
            {biz.name}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={activeView === ACQUIRE_VIEW}
          className={`g-business-tab g-business-tab-acquire${activeView === ACQUIRE_VIEW ? ' g-business-tab-active' : ''}`}
          onClick={() => {
            setActiveView(ACQUIRE_VIEW);
            setError('');
            setMessage('');
          }}
        >
          + Acquire
        </button>
      </div>

      {activeView === ACQUIRE_VIEW ? renderAcquire() : null}
      {activeBusiness ? renderBusinessManage(activeBusiness) : null}

      {error ? <p className="g-error">{error}</p> : null}
      {message ? <p className="g-note">{message}</p> : null}
    </>
  );
}
