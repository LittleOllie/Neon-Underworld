'use client';

import { useEffect, useState, type ReactNode } from 'react';
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

function formatUpgradeRemaining(completesAt: string, nowMs: number): string {
  const remaining = new Date(completesAt).getTime() - nowMs;
  if (remaining <= 0) return 'Completing…';
  const totalMin = Math.ceil(remaining / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatCompletesAt(completesAt: string): string {
  return new Date(completesAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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

type BusinessSectionProps = {
  title: string;
  badge?: string;
  hint?: string;
  children: ReactNode;
};

function BusinessSection({ title, badge, hint, children }: BusinessSectionProps) {
  return (
    <details className="g-business-section">
      <summary className="g-business-section-summary">
        <span className="g-business-section-chevron" aria-hidden />
        <span className="g-business-section-title">{title}</span>
        {badge ? <span className="g-business-section-badge">{badge}</span> : null}
      </summary>
      <div className="g-business-section-body">
        {hint ? <p className="g-business-limits">{hint}</p> : null}
        {children}
      </div>
    </details>
  );
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
  const [nowMs, setNowMs] = useState(() => Date.now());

  const hasUpgrading = data.businesses.some((b) => b.isUpgrading);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (!hasUpgrading) return;
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [hasUpgrading]);

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

  useEffect(() => {
    const due = data.businesses.some(
      (b) =>
        b.isUpgrading &&
        b.upgradeCompletesAt &&
        new Date(b.upgradeCompletesAt).getTime() <= nowMs,
    );
    if (!due) return;
    void reloadPageData(activeView === ACQUIRE_VIEW ? undefined : activeView);
  }, [nowMs, hasUpgrading, data.businesses, activeView]);

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
    setMessage(
      `Upgrade to Level ${response.data.upgradeTargetLevel} started — completes in ${response.data.upgradeCompletesAt ? formatUpgradeRemaining(response.data.upgradeCompletesAt, Date.now()) : 'soon'}.`,
    );
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
    if (biz.isUpgrading && biz.upgradeTargetLevel && biz.upgradeCompletesAt) {
      const current = getBusinessLevelStats(biz.businessType, biz.level);
      const next = getBusinessLevelStats(biz.businessType, biz.upgradeTargetLevel);
      return (
        <BusinessSection
          title="Upgrade"
          badge={`LV.${biz.level} → LV.${biz.upgradeTargetLevel}`}
        >
          <p className="g-business-upgrade-active-label">Upgrade in progress</p>
          <StatRow
            label="Progress"
            value={`Level ${biz.level} → Level ${biz.upgradeTargetLevel}`}
          />
          <StatRow
            label="Time remaining"
            value={formatUpgradeRemaining(biz.upgradeCompletesAt, nowMs)}
          />
          <StatRow label="Completes" value={formatCompletesAt(biz.upgradeCompletesAt)} />
          <p className="g-business-limits g-business-limits--compact">
            Level {biz.level} benefits remain active until completion.
          </p>
          <StatRow
            label="Workers (after)"
            value={`${current.workerCapacity.toLocaleString()} → ${next.workerCapacity.toLocaleString()}`}
          />
          <StatRow
            label="Safe (after)"
            value={`${fmtCash(current.safeCapacity)} → ${fmtCash(next.safeCapacity)}`}
          />
        </BusinessSection>
      );
    }

    if (!biz.nextUpgradeLevel || biz.nextUpgradeCost == null) {
      if (biz.level >= 5) {
        return (
          <BusinessSection title="Upgrade" badge="MAX LEVEL">
            <p className="g-business-limits g-business-limits--compact">
              This business is fully upgraded.
            </p>
          </BusinessSection>
        );
      }
      return null;
    }

    const current = getBusinessLevelStats(biz.businessType, biz.level);
    const next = getBusinessLevelStats(biz.businessType, biz.nextUpgradeLevel);
    const canAfford = data.cash >= biz.nextUpgradeCost;

    return (
      <BusinessSection
        title="Upgrade"
        badge={`Level ${biz.nextUpgradeLevel} · ${fmtCash(biz.nextUpgradeCost)}`}
      >
        <StatRow label="Cost" value={fmtCash(biz.nextUpgradeCost)} />
        {biz.nextUpgradeDurationLabel ? (
          <StatRow label="Build time" value={biz.nextUpgradeDurationLabel} />
        ) : null}
        <p className="g-business-limits g-business-limits--compact">Unlocks / improves:</p>
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
          disabled={!canAfford}
          onClick={() => runUpgrade(biz.id)}
        >
          Start Upgrade to Level {biz.nextUpgradeLevel}
        </PrimaryButton>
      </BusinessSection>
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

        <div className="g-business-overview">
          {biz.isUpgrading && biz.upgradeTargetLevel && biz.upgradeCompletesAt ? (
            <p className="g-business-upgrade-banner">
              UPGRADING → LV.{biz.upgradeTargetLevel} ·{' '}
              {formatUpgradeRemaining(biz.upgradeCompletesAt, nowMs)} remaining
            </p>
          ) : null}
          <StatRow label="Workers" value={workerCapLabel} />
          <StatRow label="Security" value={securityCapLabel} />
          <StatRow
            label="Safe"
            value={`${fmtCash(biz.safeCash)} / ${fmtCash(biz.safeCapacity)}${biz.safeFull ? ' · FULL' : ''}`}
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
        </div>

        <div className="g-business-sections" key={activeView}>
          <BusinessSection
            title="Workers"
            badge={
              biz.workerOverCapacity
                ? `${biz.assignedWorkers.toLocaleString()} / ${biz.workerCapacity.toLocaleString()} · OVER CAP`
                : `${biz.assignedWorkers.toLocaleString()} / ${biz.workerCapacity.toLocaleString()}`
            }
            hint="Assigned Workers earn passive income but are unavailable for Street work."
          >
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
          </BusinessSection>

          <BusinessSection
            title="Security"
            badge={`${biz.assignedThugs}/${biz.securityCapacity} · ${securityLabel(biz.securityBand)}`}
            hint="Assigned Thugs protect this Business but cannot attack or defend your Street operation."
          >
            <StatRow label="Street Thugs available" value={data.streetThugs.toLocaleString()} />
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
          </BusinessSection>

          <BusinessSection
            title="Safe"
            badge={biz.safeFull ? 'FULL' : fmtCash(biz.safeCash)}
            hint="Business income stays outside Street Net Worth until collected."
          >
            <PrimaryButton
              type="button"
              pending={loading === `collect-${biz.id}`}
              disabled={biz.safeCash <= 0}
              onClick={() => runCollect(biz.id)}
            >
              Collect {biz.safeCash > 0 ? fmtCash(biz.safeCash) : 'Safe'}
            </PrimaryButton>
          </BusinessSection>

          <BusinessSection
            title="Drug Storage"
            badge={`${biz.storedDrugUnits.toLocaleString()} / ${biz.drugStorageCapacity.toLocaleString()}`}
            hint="Stored drugs are hidden from Street Net Worth but increase Police Heat."
          >
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
          </BusinessSection>

          {renderUpgradeSection(biz)}
        </div>
      </div>
    );
  }

  function renderAcquire() {
    return (
      <>
        <BusinessSection
          title="Portfolio"
          badge={`${data.summary.ownedCount} / ${MAX_BUSINESSES_PER_PLAYER}`}
        >
          <StatRow label="Your cash" value={fmtCash(data.cash)} />
          <StatRow
            label="Owned"
            value={`${data.summary.ownedCount.toLocaleString()} / ${MAX_BUSINESSES_PER_PLAYER}`}
          />
          <p className="g-business-limits g-business-limits--compact">
            Up to {MAX_BUSINESSES_PER_PLAYER} businesses · upgradeable to Level 5
          </p>
        </BusinessSection>

        {data.catalog.map((entry) => (
          <details key={entry.type} className="g-business-section g-business-section--catalog">
            <summary className="g-business-section-summary">
              <span className="g-business-section-chevron" aria-hidden />
              <span className="g-business-section-title">{entry.displayName}</span>
              <span className="g-business-section-badge">{fmtCash(entry.purchasePrice)}</span>
            </summary>
            <div className="g-business-section-body">
              <p className="g-business-limits g-business-limits--compact">{entry.blurb}</p>
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
                  Buy {entry.displayName}
                </PrimaryButton>
              </div>
            </div>
          </details>
        ))}
      </>
    );
  }

  return (
    <>
      <BusinessSection
        title="Summary"
        badge={`${data.summary.ownedCount} owned · ${data.summary.overallHeatBand} heat`}
      >
        <StatRow
          label="Workers"
          value={`Street ${data.summary.streetWorkers.toLocaleString()} · Assigned ${data.summary.assignedWorkers.toLocaleString()}`}
        />
        <StatRow label="Business Safe" value={fmtCash(data.summary.totalSafeCash)} />
        <StatRow label="Stored Drugs" value={`${data.summary.totalStoredDrugs.toLocaleString()} units`} />
        <StatRow label="Portfolio Investment" value={fmtCash(data.summary.totalInvested)} />
        <StatRow label="Business Asset NW" value={fmtCash(data.summary.businessStreetAssets)} />
      </BusinessSection>

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
