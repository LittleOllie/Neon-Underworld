import {
  NET_WORTH_VALUES,
  type NetWorthResource,
  type PlayerResources,
} from '@/config/game/balance';

export function calculateNetWorth(resources: PlayerResources): number {
  let total = 0;
  for (const key of Object.keys(NET_WORTH_VALUES) as NetWorthResource[]) {
    total += resources[key] * NET_WORTH_VALUES[key];
  }
  return Math.floor(total);
}

export function netWorthDelta(before: PlayerResources, after: PlayerResources): number {
  return calculateNetWorth(after) - calculateNetWorth(before);
}
