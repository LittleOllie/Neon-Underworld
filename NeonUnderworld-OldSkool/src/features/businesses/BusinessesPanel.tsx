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
import {
  formatRecruitmentBonusDisplay,
  getBusinessTierRecruitmentContribution,
} from '@core/config/game/business-recruitment-rules';
import { StatusBadge, heatBadgeTone } from '@local/components/game/StatusBadge';
import { NumericInput } from '@local/components/game/NumericInput';
import { PrimaryButton } from '@local/components/game/PrimaryButton';
import { StatRow } from '@local/components/game/StatRow';
import { Divider } from '@local/components/game/Divider';
import { FeedbackNote } from '@local/components/game/FeedbackNote';
import { parsePositiveInteger, validateQuantity } from '@local/lib/numeric-input';
import { ACTION_PENDING } from '@local/lib/loading-copy';
import { OS_TERMS, enforcersLabel, resourceLabel, specialistsLabel } from '@local/config/terminology';

function fmtCash(n: number): string {
  return `$${n.toLocaleString()}`;
}

function renderRecruitmentStatRows(biz: BusinessesPageData['businesses'][number]) {
  const rows: ReactNode[] = [];
  if (biz.workerRecruitmentContribution > 0) {
    rows.push(
      <StatRow
        key="worker-recruitment"
        label={`${OS_TERMS.specialist} Recruitment`}
        value={formatRecruitmentBonusDisplay(biz.workerRecruitmentContribution)}
      />,
    );
  }
  if (biz.thugRecruitmentContribution > 0) {
    rows.push(
      <StatRow
        key="thug-recruitment"
        label={`${OS_TERMS.enforcer} Recruitment`}
        value={formatRecruitmentBonusDisplay(biz.thugRecruitmentContribution)}
      />,
    );
  }
  return rows;
}

type Props = {
  initialData: BusinessesPageData;
};

type DrugKey = 'hash' | 'shrooms' | 'coke' | 'heroin';
type ViewId = string;

const DRUG_LABELS: Record<DrugKey, string> = {
  hash: resourceLabel('hash'),
  shrooms: resourceLabel('shrooms'),
  coke: resourceLabel('coke'),
  heroin: resourceLabel('heroin'),
};

const ACQUIRE_VIEW = 'acquire';

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
    const key = `buy-${type}`;
    if (loading === key) return;
    setLoading(key);
    setError('');
    setMessage('');
    try {
      const response = await purchaseBusinessAction(type, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      applyShell(response.data);
      const ok = await reloadPageData(response.data.businessId);
      if (ok) {
        setMessage(`Acquired ${response.data.businessName} for ${fmtCash(response.data.purchasePrice)}.`);
      }
    } finally {
      setLoading(null);
    }
  }

  async function runCollect(businessId: string) {
    const key = `collect-${businessId}`;
    if (loading === key) return;
    setLoading(key);
    setError('');
    try {
      const response = await collectBusinessSafeAction(businessId, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      applyShell(response.data);
      setData((prev) => patchCollectState(prev, businessId, response.data.newCash));
      setMessage(`Collected $${response.data.collected.toLocaleString()}.`);
    } finally {
      setLoading(null);
    }
  }

  async function runWorkers(businessId: string, mode: 'assign' | 'remove') {
    const key = `${mode}-${businessId}`;
    if (loading === key) return;
    const qty = parsePositiveInteger(workerQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-${businessId}`);
    setError('');
    setMessage('');
    try {
      const action = mode === 'assign' ? assignBusinessWorkersAction : removeBusinessWorkersAction;
      const response = await action(businessId, qty!, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      applyShell(response.data);
      setData((prev) => {
        const biz = prev.businesses.find((b) => b.id === businessId);
        return patchWorkerState(
          prev,
          businessId,
          response.data.assignedWorkers,
          response.data.streetWorkers,
          biz?.level ?? 1,
          biz?.businessType ?? 'NIGHTCLUB',
        );
      });
      setMessage(
        mode === 'assign'
          ? `Assigned ${qty!.toLocaleString()} ${specialistsLabel(qty!)}.`
          : `Removed ${qty!.toLocaleString()} ${specialistsLabel(qty!)}.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function runSecurity(businessId: string, mode: 'assign' | 'remove') {
    const key = `${mode}-sec-${businessId}`;
    if (loading === key) return;
    const qty = parsePositiveInteger(thugQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-sec-${businessId}`);
    setError('');
    setMessage('');
    try {
      const action = mode === 'assign' ? assignBusinessSecurityAction : removeBusinessSecurityAction;
      const response = await action(businessId, qty!, uuidv4());
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
          ? `Assigned ${qty!.toLocaleString()} ${enforcersLabel(qty!)} to security.`
          : `Removed ${qty!.toLocaleString()} ${enforcersLabel(qty!)} from security.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function runUpgrade(businessId: string) {
    const key = `upgrade-${businessId}`;
    if (loading === key) return;
    setLoading(key);
    setError('');
    setMessage('');
    try {
      const response = await upgradeBusinessAction(businessId, uuidv4());
      if (!response.success) {
        setError(response.error);
        return;
      }
      applyShell(response.data);
      await reloadPageData(businessId);
      setMessage(
        `Upgrade to Level ${response.data.upgradeTargetLevel} started — completes in ${response.data.upgradeCompletesAt ? formatUpgradeRemaining(response.data.upgradeCompletesAt, Date.now()) : 'soon'}.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function runDrug(businessId: string, mode: 'store' | 'withdraw') {
    const drug = (drugType[businessId] ?? 'hash') as DrugKey;
    const key = `${mode}-${businessId}-${drug}`;
    if (loading === key) return;
    const qty = parsePositiveInteger(drugQty[businessId] ?? '1');
    const validationError = validateQuantity(qty);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(`${mode}-${businessId}-${drug}`);
    setError('');
    setMessage('');
    try {
      const action = mode === 'store' ? storeBusinessDrugsAction : withdrawBusinessDrugsAction;
      const response = await action(businessId, drug, qty!, uuidv4());
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
    } finally {
      setLoading(null);
    }
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
            label={`${OS_TERMS.specialists} (after)`}
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
          label={OS_TERMS.specialists}
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
        {(() => {
          const currentRecruitment = getBusinessTierRecruitmentContribution(
            biz.businessType,
            biz.level,
          );
          const nextRecruitment = getBusinessTierRecruitmentContribution(
            biz.businessType,
            biz.nextUpgradeLevel,
          );
          const rows: ReactNode[] = [];
          if (currentRecruitment.workerPercent > 0 || nextRecruitment.workerPercent > 0) {
            rows.push(
              <StatRow
                key="worker-network"
                label={`${OS_TERMS.specialist} Recruitment`}
                value={`${formatRecruitmentBonusDisplay(currentRecruitment.workerPercent)} → ${formatRecruitmentBonusDisplay(nextRecruitment.workerPercent)}`}
              />,
            );
          }
          if (currentRecruitment.thugPercent > 0 || nextRecruitment.thugPercent > 0) {
            rows.push(
              <StatRow
                key="thug-network"
                label={`${OS_TERMS.enforcer} Recruitment`}
                value={`${formatRecruitmentBonusDisplay(currentRecruitment.thugPercent)} → ${formatRecruitmentBonusDisplay(nextRecruitment.thugPercent)}`}
              />,
            );
          }
          return rows;
        })()}
        <PrimaryButton
          type="button"
          pending={loading === `upgrade-${biz.id}`}
          disabled={loading === `upgrade-${biz.id}` || !canAfford}
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
          <StatRow label={OS_TERMS.specialists} value={workerCapLabel} />
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
          {renderRecruitmentStatRows(biz)}
          <StatRow
            label={OS_TERMS.heat}
            value={<StatusBadge tone={heatBadgeTone(biz.heatBand)}>{biz.heatLabel}</StatusBadge>}
          />
        </div>

        <div className="g-business-sections" key={activeView}>
          <BusinessSection
            title={OS_TERMS.specialists}
            badge={
              biz.workerOverCapacity
                ? `${biz.assignedWorkers.toLocaleString()} / ${biz.workerCapacity.toLocaleString()} · OVER CAP`
                : `${biz.assignedWorkers.toLocaleString()} / ${biz.workerCapacity.toLocaleString()}`
            }
            hint={`Assigned ${OS_TERMS.specialists} earn passive income but are unavailable for Operations.`}
          >
            <StatRow label="Unassigned" value={data.streetWorkers.toLocaleString()} />
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
                disabled={
                  loading === `assign-${biz.id}` ||
                  biz.workerOverCapacity ||
                  biz.assignedWorkers >= biz.workerCapacity
                }
                onClick={() => runWorkers(biz.id, 'assign')}
              >
                Assign
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="secondary"
                pending={loading === `remove-${biz.id}`}
                disabled={loading === `remove-${biz.id}` || biz.assignedWorkers <= 0}
                onClick={() => runWorkers(biz.id, 'remove')}
              >
                Remove
              </PrimaryButton>
            </div>
          </BusinessSection>

          <BusinessSection
            title="Security"
            badge={`${biz.assignedThugs}/${biz.securityCapacity} · ${securityLabel(biz.securityBand)}`}
            hint={`Assigned ${OS_TERMS.enforcers} protect this Business but cannot attack or defend your active operation.`}
          >
            <StatRow label={`Unassigned ${OS_TERMS.enforcers}`} value={data.streetThugs.toLocaleString()} />
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
                disabled={
                  loading === `assign-sec-${biz.id}` ||
                  biz.securityOverCapacity ||
                  biz.assignedThugs >= biz.securityCapacity
                }
                onClick={() => runSecurity(biz.id, 'assign')}
              >
                Assign Security
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="secondary"
                pending={loading === `remove-sec-${biz.id}`}
                disabled={loading === `remove-sec-${biz.id}` || biz.assignedThugs <= 0}
                onClick={() => runSecurity(biz.id, 'remove')}
              >
                Remove
              </PrimaryButton>
            </div>
          </BusinessSection>

          <BusinessSection
            title="Safe"
            badge={biz.safeFull ? 'FULL' : fmtCash(biz.safeCash)}
            hint={`Business income stays outside active ${OS_TERMS.influence} until collected.`}
          >
            <PrimaryButton
              type="button"
              pending={loading === `collect-${biz.id}`}
              disabled={loading === `collect-${biz.id}` || biz.safeCash <= 0}
              onClick={() => runCollect(biz.id)}
            >
              {loading === `collect-${biz.id}`
                ? ACTION_PENDING.businessCollect
                : `Collect ${biz.safeCash > 0 ? fmtCash(biz.safeCash) : 'Safe'}`}
            </PrimaryButton>
          </BusinessSection>

          <BusinessSection
            title={`${OS_TERMS.technology} Storage`}
            badge={`${biz.storedDrugUnits.toLocaleString()} / ${biz.drugStorageCapacity.toLocaleString()}`}
            hint={`Stored technology is hidden from ${OS_TERMS.influence} but increases ${OS_TERMS.heat} and ${OS_TERMS.securitySweep} risk.`}
          >
            {(['hash', 'shrooms', 'coke', 'heroin'] as const).map((key) => (
              <StatRow
                key={key}
                label={DRUG_LABELS[key]}
                value={`Unassigned ${data.streetDrugs[key].toLocaleString()} · Stored ${biz.storedDrugs[key].toLocaleString()}`}
              />
            ))}
            <label className="g-field-label">
              {OS_TERMS.technology}
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
                disabled={loading === `store-${biz.id}-${drugType[biz.id] ?? 'hash'}`}
                onClick={() => runDrug(biz.id, 'store')}
              >
                Store
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="secondary"
                pending={loading === `withdraw-${biz.id}-${drugType[biz.id] ?? 'hash'}`}
                disabled={loading === `withdraw-${biz.id}-${drugType[biz.id] ?? 'hash'}`}
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

        {data.summary.ownedCount === 0 ? (
          <section className="g-business-aspiration" aria-label="Business progression">
            <h3 className="g-business-aspiration-title">Build something bigger</h3>
            <p className="g-note g-business-aspiration-body">
              Your first {OS_TERMS.warehouse} costs{' '}
              <strong>
                {fmtCash(
                  data.catalog.find((e) => e.type === 'WAREHOUSE')?.purchasePrice ??
                    data.catalog[0]?.purchasePrice ??
                    0
                )}
              </strong>
              . Grow your operation, build your cash reserves, and turn street crew into a real
              empire.
            </p>
          </section>
        ) : null}

        {data.catalog.map((entry) => (
          <details key={entry.type} className="g-business-section g-business-section--catalog">
            <summary className="g-business-section-summary">
              <span className="g-business-section-chevron" aria-hidden />
              <span className="g-business-section-title">{entry.displayName}</span>
              <span className="g-business-section-badge">{fmtCash(entry.purchasePrice)}</span>
            </summary>
            <div className="g-business-section-body">
              <p className="g-business-limits g-business-limits--compact">{entry.blurb}</p>
              <StatRow label={OS_TERMS.specialists} value={`${entry.workerCapacity.toLocaleString()} max`} />
              <StatRow label="Safe" value={fmtCash(entry.safeCapacity)} />
              <StatRow label="Storage" value={`${entry.drugStorageCapacity.toLocaleString()} units`} />
              <StatRow label="Income" value={incomeLabel(entry.type)} />
              <StatRow label={OS_TERMS.heat} value={heatDescriptor(entry.baseHeat)} />
              <StatRow label={`Active ${OS_TERMS.influence}`} value={fmtCash(entry.streetNwContribution)} />
              <div className="g-business-panel-actions">
                <PrimaryButton
                  type="button"
                  pending={loading === `buy-${entry.type}`}
                  disabled={
                    loading === `buy-${entry.type}` ||
                    !data.canPurchase ||
                    data.cash < entry.purchasePrice
                  }
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
    <div>
      {error ? <FeedbackNote tone="error" role="alert">{error}</FeedbackNote> : null}
      {message ? <FeedbackNote tone="success" role="status">{message}</FeedbackNote> : null}

      <BusinessSection
        title="Business Network"
        badge={
          data.summary.workerRecruitmentBonusPercent > 0 ||
          data.summary.thugRecruitmentBonusPercent > 0
            ? 'Active'
            : 'None'
        }
      >
        <StatRow
          label={`${OS_TERMS.specialist} Capacity`}
          value={data.summary.totalWorkerCapacity.toLocaleString()}
        />
        <StatRow
          label={`${OS_TERMS.specialist} Recruitment`}
          value={formatRecruitmentBonusDisplay(data.summary.workerRecruitmentBonusPercent)}
        />
        <StatRow
          label={`${OS_TERMS.enforcer} Recruitment`}
          value={formatRecruitmentBonusDisplay(data.summary.thugRecruitmentBonusPercent)}
        />
        <details className="g-business-network-info">
          <summary className="g-business-network-info-summary">How Businesses Work</summary>
          <div className="g-business-network-info-body">
            <p className="g-note g-business-limits--compact">
              Businesses earn money, hold crew, and expand your connections across the city.
            </p>
            <p className="g-note g-business-limits--compact">
              <strong>{OS_TERMS.specialist} Capacity</strong> — assign {OS_TERMS.specialists} to earn
              passively. Upgrades increase capacity.
            </p>
            <p className="g-note g-business-limits--compact">
              <strong>Business Network</strong> — owning and upgrading improves {OS_TERMS.specialist}{' '}
              and/or {OS_TERMS.enforcer} recruitment while Scouting. Bonuses affect people recruited
              only — not Scout cash.
            </p>
            <p className="g-note g-business-limits--compact">
              <strong>{OS_TERMS.warehouse}</strong> — stronger {OS_TERMS.specialist} recruitment.
            </p>
            <p className="g-note g-business-limits--compact">
              <strong>{OS_TERMS.nightclub}</strong> — improves {OS_TERMS.specialist} and{' '}
              {OS_TERMS.enforcer} recruitment.
            </p>
            <p className="g-note g-business-limits--compact">
              <strong>{OS_TERMS.drugLab}</strong> — stronger {OS_TERMS.enforcer} recruitment; keeps
              its production benefits.
            </p>
            <p className="g-note g-business-limits--compact">
              Upgrades strengthen your recruitment network. As your empire grows (staffed businesses,
              crew size, portfolio depth), Scout actions recruit more — at no extra cash cost per Scout.
            </p>
          </div>
        </details>
      </BusinessSection>

      <Divider />

      <BusinessSection
        title="Summary"
        badge={`${data.summary.ownedCount} owned · ${data.summary.overallHeatBand} ${OS_TERMS.heat.toLowerCase()}`}
      >
        <StatRow
          label={OS_TERMS.specialists}
          value={`Unassigned ${data.summary.streetWorkers.toLocaleString()} · Assigned ${data.summary.assignedWorkers.toLocaleString()}`}
        />
        <StatRow label="Business Safe" value={fmtCash(data.summary.totalSafeCash)} />
        <StatRow label={`Stored ${OS_TERMS.technology}`} value={`${data.summary.totalStoredDrugs.toLocaleString()} units`} />
        <StatRow label="Portfolio Investment" value={fmtCash(data.summary.totalInvested)} />
        <StatRow label={`Business Asset ${OS_TERMS.influence}`} value={fmtCash(data.summary.businessStreetAssets)} />
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
    </div>
  );
}
