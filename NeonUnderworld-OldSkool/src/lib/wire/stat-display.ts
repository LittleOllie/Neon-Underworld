import { formatRank } from '@local/lib/format-rank';
import { OS_TERMS } from '@local/config/terminology';
import { formatTurnsExact } from '@local/server/domain/status-presentation';
import type { WireStatKind } from './types';

export interface WireStatDisplay {
  label: string;
  value: string;
}

export interface WireExecutorStats {
  cash: number;
  netWorth: number;
  rank: number;
  turns: number;
  turnCap: number;
  workers?: number;
  thugs?: number;
}

export function formatWireStat(stat: WireStatKind, stats: WireExecutorStats): WireStatDisplay {
  switch (stat) {
    case 'cash':
      return { label: OS_TERMS.cash.toUpperCase(), value: `$${stats.cash.toLocaleString()}` };
    case 'netWorth':
      return { label: OS_TERMS.influence.toUpperCase(), value: `$${stats.netWorth.toLocaleString()}` };
    case 'rank':
      return { label: 'DISTRICT RANK', value: formatRank(stats.rank) };
    case 'turns':
      return { label: OS_TERMS.turns.toUpperCase(), value: formatTurnsExact(stats.turns, stats.turnCap) };
    case 'workers':
      return { label: OS_TERMS.specialists.toUpperCase(), value: (stats.workers ?? 0).toLocaleString() };
    case 'thugs':
      return { label: OS_TERMS.enforcers.toUpperCase(), value: (stats.thugs ?? 0).toLocaleString() };
    default: {
      const _exhaustive: never = stat;
      return _exhaustive;
    }
  }
}

export const WIRE_EXAMPLE_COMMANDS = [
  'buy 100 rations',
  'buy max aks',
  "what's my rank",
  'open operations',
] as const;

export const WIRE_UNKNOWN_HELP = [
  'buy 100 rations',
  'buy max aks',
  "what's my cash",
  'open shop',
] as const;

export const WIRE_HIRE_THUGS_MESSAGE = `${OS_TERMS.enforcers.toUpperCase()} HIRING VIA THE WIRE IS COMING SOON`;
