import { formatRank } from '@local/lib/format-rank';
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
      return { label: 'STREET CASH', value: `$${stats.cash.toLocaleString()}` };
    case 'netWorth':
      return { label: 'NET WORTH', value: `$${stats.netWorth.toLocaleString()}` };
    case 'rank':
      return { label: 'DISTRICT RANK', value: formatRank(stats.rank) };
    case 'turns':
      return { label: 'TURNS', value: formatTurnsExact(stats.turns, stats.turnCap) };
    case 'workers':
      return { label: 'WORKERS', value: (stats.workers ?? 0).toLocaleString() };
    case 'thugs':
      return { label: 'THUGS', value: (stats.thugs ?? 0).toLocaleString() };
    default: {
      const _exhaustive: never = stat;
      return _exhaustive;
    }
  }
}

export const WIRE_EXAMPLE_COMMANDS = [
  'buy 100 beer',
  'buy max aks',
  "what's my rank",
  'open empire',
] as const;

export const WIRE_UNKNOWN_HELP = [
  'buy 100 beer',
  'buy max aks',
  "what's my cash",
  'open shop',
] as const;

export const WIRE_HIRE_THUGS_MESSAGE = 'THUG HIRING VIA THE WIRE IS COMING SOON';
