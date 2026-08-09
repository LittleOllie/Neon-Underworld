import type { CanonicalPlayerContext } from '@local/server/services/player.service';
import type { CommandEmpireBrief } from '@local/domain/empire.model';
import { buildWorkerStabilityMeter, buildBeerSupplyMeter } from '@local/server/domain/status-presentation';

export interface AttentionItem {
  id: string;
  /** @deprecated use value + label */
  text?: string;
  value?: string;
  label?: string;
  href?: string;
  severity?: 'alert' | 'info';
  icon?: 'reports' | 'warning' | 'info';
}

export function collectAttentionItems(input: {
  ctx: CanonicalPlayerContext;
  brief: CommandEmpireBrief;
  unreadCount: number;
}): AttentionItem[] {
  const { ctx, brief, unreadCount } = input;
  const items: AttentionItem[] = [];

  if (unreadCount > 0) {
    items.push({
      id: 'reports-unread',
      value: String(unreadCount),
      label: `unread report${unreadCount === 1 ? '' : 's'}`,
      href: '/reports?filter=unread',
      severity: 'alert',
      icon: 'reports',
    });
  }

  if (brief.unarmedThugs > 0) {
    items.push({
      id: 'unarmed-thugs',
      value: String(brief.unarmedThugs),
      label: `thug${brief.unarmedThugs === 1 ? '' : 's'} are unarmed`,
      href: '/shop?tab=weapons',
      severity: 'alert',
      icon: 'warning',
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
    });
  }

  const workerMeter = buildWorkerStabilityMeter(row);
  if (workerMeter.supportingText?.includes('Condom')) {
    items.push({
      id: 'worker-condoms',
      label: 'Worker supplies are low — condoms',
      href: '/shop?tab=supplies',
      severity: 'info',
      icon: 'warning',
    });
  } else if (workerMeter.supportingText?.includes('Hash')) {
    items.push({
      id: 'worker-hash',
      label: 'Worker supplies are low — hash',
      href: '/shop?tab=drugs',
      severity: 'info',
      icon: 'warning',
    });
  } else if (ctx.condoms < 5 && ctx.prostitutes > 0) {
    items.push({
      id: 'worker-supplies',
      label: 'Worker supplies are low',
      href: '/shop?tab=supplies',
      severity: 'info',
      icon: 'warning',
    });
  }

  const beerMeter = buildBeerSupplyMeter(row);
  if (beerMeter.value < 40 && ctx.thugs > 0) {
    items.push({
      id: 'beer-supply',
      label: 'Beer supply is low',
      href: '/shop?tab=supplies',
      severity: 'info',
      icon: 'warning',
    });
  }

  if (ctx.travelling && ctx.travelDestination) {
    items.push({
      id: 'travel',
      label: `Travel in progress — ${ctx.travelDestination}`,
      href: '/empire',
      severity: 'info',
      icon: 'info',
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function prioritizeAttentionItems(items: AttentionItem[], limit = 3): {
  visible: AttentionItem[];
  remaining: number;
} {
  const visible = items.slice(0, limit);
  return { visible, remaining: Math.max(0, items.length - limit) };
}
