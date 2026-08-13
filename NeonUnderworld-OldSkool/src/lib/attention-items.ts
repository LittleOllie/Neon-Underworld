import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import type { CommandEmpireBrief } from '@local/domain/empire.model';
import type { BusinessOperationsSummary } from '@local/lib/business-heat-display';
import { buildWorkerStabilityMeter, buildBeerSupplyMeter } from '@local/server/domain/status-presentation';

export interface AttentionItem {
  id: string;
  /** @deprecated use value + label */
  text?: string;
  value?: string;
  label?: string;
  href?: string;
  severity?: 'alert' | 'info' | 'critical';
  icon?: 'reports' | 'warning' | 'info';
  headline?: string;
  /** Lower = higher priority. Used when merging buckets. */
  priority?: number;
}

export interface DefenceAlertSummary {
  reportId: string;
  attackerAlias: string;
  attackType: string;
  outcome: string;
  cashStolen: number;
  workersStolen: number;
}

export interface SystemAttentionReport {
  reportId: string;
  type: 'POLICE_RAID' | 'BUSINESS_UPGRADE_COMPLETE';
  businessName?: string;
  toLevel?: number;
}

export interface CartelInviteAttention {
  id: string;
  cartelName: string;
}

export interface AttentionExtras {
  defenceAlerts?: DefenceAlertSummary[];
  systemReports?: SystemAttentionReport[];
  cartelInvites?: CartelInviteAttention[];
  businessOperations?: BusinessOperationsSummary | null;
}

const PRIORITY = {
  defence: 10,
  poach: 11,
  policeRaid: 20,
  criticalHeat: 25,
  criticalSupply: 30,
  safeFull: 40,
  upgradeComplete: 45,
  cartelInvite: 50,
  overCapacity: 55,
  unarmed: 60,
  supplies: 70,
  beer: 75,
  businessHeat: 80,
  unread: 90,
  travel: 95,
  productionTurns: 96,
} as const;

function fmtCash(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function pushDefenceAlerts(items: AttentionItem[], defenceAlerts: DefenceAlertSummary[]) {
  const poachAlerts = defenceAlerts.filter((a) => a.attackType === 'POACH_WORKERS');
  const combatAlerts = defenceAlerts.filter((a) => a.attackType !== 'POACH_WORKERS');

  if (poachAlerts.length > 0) {
    const latest = poachAlerts[0]!;
    const lossLine =
      latest.workersStolen > 0
        ? `${latest.workersStolen.toLocaleString()} workers taken`
        : 'poach attempt on your crew';
    items.push({
      id: 'workers-poached',
      headline:
        poachAlerts.length > 1 ? `WORKERS POACHED ${poachAlerts.length} TIMES` : 'WORKERS POACHED',
      label: `${latest.attackerAlias} — ${lossLine}`,
      href:
        poachAlerts.length > 1 ? '/reports?filter=unread' : `/reports/${latest.reportId}`,
      severity: 'critical',
      icon: 'warning',
      priority: PRIORITY.poach,
    });
  }

  if (combatAlerts.length > 0) {
    const latest = combatAlerts[0]!;
    const lossLine =
      latest.cashStolen > 0
        ? `${fmtCash(latest.cashStolen)} stolen`
        : 'crew or assets hit';
    items.push({
      id: 'you-were-attacked',
      headline:
        combatAlerts.length > 1
          ? `YOU WERE ATTACKED ${combatAlerts.length} TIMES`
          : 'YOU WERE ATTACKED',
      label: `${latest.attackerAlias} — ${lossLine}`,
      href:
        combatAlerts.length > 1 ? '/reports?filter=unread' : `/reports/${latest.reportId}`,
      severity: 'critical',
      icon: 'warning',
      priority: PRIORITY.defence,
    });
  }
}

function pushSystemReports(items: AttentionItem[], systemReports: SystemAttentionReport[]) {
  const raids = systemReports.filter((r) => r.type === 'POLICE_RAID');
  const upgrades = systemReports.filter((r) => r.type === 'BUSINESS_UPGRADE_COMPLETE');

  if (raids.length > 0) {
    const latest = raids[0]!;
    items.push({
      id: 'police-raid',
      headline: raids.length > 1 ? `${raids.length} POLICE RAIDS` : 'POLICE RAID',
      label:
        latest.businessName != null
          ? `${latest.businessName} was hit by authorities.`
          : 'One of your businesses was hit.',
      href: raids.length > 1 ? '/reports?filter=unread' : `/reports/${latest.reportId}`,
      severity: 'critical',
      icon: 'warning',
      priority: PRIORITY.policeRaid,
    });
  }

  if (upgrades.length > 0) {
    const latest = upgrades[0]!;
    const levelText =
      latest.toLevel != null && latest.businessName != null
        ? `${latest.businessName} is now Level ${latest.toLevel}.`
        : latest.businessName != null
          ? `${latest.businessName} upgrade finished.`
          : 'A business upgrade finished.';
    items.push({
      id: 'business-upgrade-complete',
      headline: upgrades.length > 1 ? `${upgrades.length} UPGRADES COMPLETE` : 'UPGRADE COMPLETE',
      label: levelText,
      href:
        upgrades.length > 1
          ? '/reports?filter=unread'
          : latest.businessName != null
            ? '/businesses'
            : `/reports/${latest.reportId}`,
      severity: 'alert',
      icon: 'info',
      priority: PRIORITY.upgradeComplete,
    });
  }
}

function pushBusinessAttention(
  items: AttentionItem[],
  businessOperations: BusinessOperationsSummary | null | undefined,
) {
  if (!businessOperations || businessOperations.owned <= 0) return;

  const safeFullCount = businessOperations.safeFullCount ?? 0;
  const safeFullSites = businessOperations.safeFullSites ?? [];

  if (safeFullCount > 0) {
    const first = safeFullSites[0];
    items.push({
      id: 'business-safe-full',
      headline:
        safeFullCount > 1 ? `${safeFullCount} BUSINESS SAFES FULL` : 'BUSINESS SAFE FULL',
      label:
        safeFullCount === 1 && first
          ? `${first.name} reached its ${fmtCash(first.safeCapacity)} Safe capacity. Income is paused until you collect it.`
          : 'Income is paused on full Safes until you collect.',
      href: '/businesses',
      severity: 'alert',
      icon: 'warning',
      priority: PRIORITY.safeFull,
    });
  }

  const criticalHeatCount = businessOperations.criticalHeatCount ?? 0;
  if (criticalHeatCount > 0) {
    const first = businessOperations.criticalHeatSites?.[0];
    items.push({
      id: 'business-critical-heat',
      headline:
        criticalHeatCount > 1 ? `${criticalHeatCount} BUSINESSES AT CRITICAL HEAT` : 'CRITICAL BUSINESS HEAT',
      label:
        first != null
          ? `${first.name} is at critical heat — raid risk is elevated.`
          : 'A business is at critical heat.',
      href: '/businesses',
      severity: 'critical',
      icon: 'warning',
      priority: PRIORITY.criticalHeat,
    });
  }

  const overCapacityCount = businessOperations.overCapacityCount ?? 0;
  if (overCapacityCount > 0) {
    items.push({
      id: 'business-over-capacity',
      headline:
        overCapacityCount > 1
          ? `${overCapacityCount} BUSINESSES OVER CAPACITY`
          : 'BUSINESS OVER CAPACITY',
      label: 'Workers or Security exceed capacity — adjust assignments.',
      href: '/businesses',
      severity: 'alert',
      icon: 'warning',
      priority: PRIORITY.overCapacity,
    });
  }

  const hasCriticalHeat = criticalHeatCount > 0;
  if (
    !hasCriticalHeat &&
    businessOperations.overallHeat === 'HIGH' &&
    businessOperations.sites.length > 0
  ) {
    items.push({
      id: 'business-heat-high',
      headline: 'BUSINESS HEAT HIGH',
      label: 'At least one business has elevated heat.',
      href: '/businesses',
      severity: 'info',
      icon: 'info',
      priority: PRIORITY.businessHeat,
    });
  }
}

function pushCartelInvites(items: AttentionItem[], cartelInvites: CartelInviteAttention[]) {
  if (cartelInvites.length === 0) return;
  const first = cartelInvites[0]!;
  items.push({
    id: 'cartel-invitation',
    headline:
      cartelInvites.length > 1
        ? `${cartelInvites.length} CARTEL INVITATIONS`
        : 'CARTEL INVITATION',
    label: `You've been invited to join ${first.cartelName}.`,
    href: '/cartels',
    severity: 'alert',
    icon: 'info',
    priority: PRIORITY.cartelInvite,
  });
}

export function collectAttentionItems(input: {
  ctx: CanonicalPlayerContext;
  brief: CommandEmpireBrief;
  unreadCount: number;
  extras?: AttentionExtras;
}): AttentionItem[] {
  const { ctx, brief, unreadCount, extras = {} } = input;
  const {
    defenceAlerts = [],
    systemReports = [],
    cartelInvites = [],
    businessOperations = null,
  } = extras;
  const items: AttentionItem[] = [];

  pushDefenceAlerts(items, defenceAlerts);
  pushSystemReports(items, systemReports);
  pushBusinessAttention(items, businessOperations);
  pushCartelInvites(items, cartelInvites);

  const hasSpecificReportAlert =
    defenceAlerts.length > 0 ||
    systemReports.some((r) => r.type === 'POLICE_RAID' || r.type === 'BUSINESS_UPGRADE_COMPLETE');

  if (!hasSpecificReportAlert && unreadCount > 0) {
    items.push({
      id: 'reports-unread',
      value: String(unreadCount),
      label: `unread report${unreadCount === 1 ? '' : 's'}`,
      href: '/reports?filter=unread',
      severity: 'info',
      icon: 'reports',
      priority: PRIORITY.unread,
    });
  } else if (unreadCount > 0 && hasSpecificReportAlert) {
    const covered = defenceAlerts.length + systemReports.length;
    const remaining = Math.max(0, unreadCount - covered);
    if (remaining > 0) {
      items.push({
        id: 'reports-unread',
        value: String(remaining),
        label: `other unread report${remaining === 1 ? '' : 's'}`,
        href: '/reports?filter=unread',
        severity: 'info',
        icon: 'reports',
        priority: PRIORITY.unread,
      });
    }
  }

  if (brief.unarmedThugs > 0) {
    items.push({
      id: 'unarmed-thugs',
      value: String(brief.unarmedThugs),
      label: `street thug${brief.unarmedThugs === 1 ? '' : 's'} unarmed`,
      href: '/shop?tab=weapons',
      severity: 'alert',
      icon: 'warning',
      priority: PRIORITY.unarmed,
    });
  }

  const row = {
    thugs: ctx.thugs,
    prostitutes: ctx.prostitutes,
    glocks: ctx.glocks,
    uzis: ctx.uzis,
    aks: ctx.aks,
    rides: ctx.rides,
    hash: ctx.hash,
    shrooms: ctx.shrooms,
    coke: ctx.coke,
    heroin: ctx.heroin,
    businesses: ctx.businesses,
    condoms: ctx.condoms,
    beer: ctx.beer,
    prostitutePayoutPercent: ctx.prostitutePayoutPercent,
  };

  if (ctx.prostitutes > 0 && ctx.turns < 1) {
    items.push({
      id: 'production-turns',
      label: 'Turns required for production',
      href: '/produce',
      severity: 'info',
      icon: 'info',
      priority: PRIORITY.productionTurns,
    });
  }

  const workerMeter = buildWorkerStabilityMeter(row);
  const workerCritical = workerMeter.band === 'critical' || workerMeter.band === 'low';

  if (workerMeter.supportingText?.includes('Condom')) {
    items.push({
      id: 'worker-condoms',
      label: 'Street worker supplies are low — condoms',
      href: '/shop?tab=supplies',
      severity: workerCritical ? 'alert' : 'info',
      icon: 'warning',
      priority: workerCritical ? PRIORITY.criticalSupply : PRIORITY.supplies,
    });
  } else if (workerMeter.supportingText?.includes('Hash')) {
    items.push({
      id: 'worker-hash',
      label: 'Street worker supplies are low — hash',
      href: '/shop?tab=drugs',
      severity: workerCritical ? 'alert' : 'info',
      icon: 'warning',
      priority: workerCritical ? PRIORITY.criticalSupply : PRIORITY.supplies,
    });
  } else if (ctx.condoms < 5 && ctx.prostitutes > 0) {
    items.push({
      id: 'worker-supplies',
      label: 'Street worker supplies are low',
      href: '/shop?tab=supplies',
      severity: 'info',
      icon: 'warning',
      priority: PRIORITY.supplies,
    });
  }

  const beerMeter = buildBeerSupplyMeter(row);
  if (beerMeter.value < 40 && ctx.thugs > 0) {
    items.push({
      id: 'beer-supply',
      label: 'Beer supply is low for street thugs',
      href: '/shop?tab=supplies',
      severity: beerMeter.value < 25 ? 'alert' : 'info',
      icon: 'warning',
      priority: PRIORITY.beer,
    });
  }

  if (ctx.travelling && ctx.travelDestination) {
    items.push({
      id: 'travel',
      label: `Travel in progress — ${ctx.travelDestination}`,
      href: '/empire',
      severity: 'info',
      icon: 'info',
      priority: PRIORITY.travel,
    });
  }

  const seen = new Set<string>();
  const deduped = items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return deduped.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
}

export function prioritizeAttentionItems(items: AttentionItem[], limit = 5): {
  visible: AttentionItem[];
  remaining: number;
} {
  const visible = items.slice(0, limit);
  return { visible, remaining: Math.max(0, items.length - limit) };
}
