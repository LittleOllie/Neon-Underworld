import type { WireCommand, WireStatKind } from './types';
import { OS_TERMS } from '@local/config/terminology';
import {
  isThugPurchaseTerm,
  isWorkerPurchaseTerm,
  resolveShopItemFromPhrase,
} from './item-aliases';
import { isMaxQuantityKeyword, parseLeadingQuantity } from './parse-quantity';
import { resolveWireRoute, stripNavigationPrefix } from './route-map';

export function normalizeWireInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^\w\s,-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function unknown(reason?: string): WireCommand {
  return { kind: 'UNKNOWN', reason };
}

function parseStat(normalized: string): WireCommand | null {
  const statMatchers: { stat: WireStatKind; patterns: RegExp[] }[] = [
    {
      stat: 'cash',
      patterns: [
        /^what(?:s| is) my cash$/,
        /^how much cash do i have$/,
        /^my cash$/,
        /^cash$/,
      ],
    },
    {
      stat: 'netWorth',
      patterns: [
        /^what(?:s| is) my net worth$/,
        /^what is my net worth$/,
        /^how much is my net worth$/,
        /^my net worth$/,
        /^net worth$/,
      ],
    },
    {
      stat: 'rank',
      patterns: [/^what(?:s| is) my rank$/, /^my rank$/, /^rank$/],
    },
    {
      stat: 'turns',
      patterns: [/^how many turns do i have$/, /^what(?:s| is) my turns$/, /^my turns$/, /^turns$/],
    },
    {
      stat: 'workers',
      patterns: [
        /^how many workers do i have$/,
        /^what(?:s| is) my workers$/,
        /^my workers$/,
        /^workers$/,
      ],
    },
    {
      stat: 'thugs',
      patterns: [/^how many thugs do i have$/, /^what(?:s| is) my thugs$/, /^my thugs$/, /^thugs$/],
    },
  ];

  for (const { stat, patterns } of statMatchers) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return { kind: 'STAT', stat };
    }
  }

  return null;
}

function parseHireThugs(normalized: string): WireCommand | null {
  const hireMatch = normalized.match(/^(?:hire|recruit)\s+(.+)$/);
  const buyMatch = normalized.match(/^buy\s+(.+)$/);
  const tail = hireMatch?.[1] ?? (buyMatch ? tryBuyThugTail(buyMatch[1]) : null);
  if (!tail) return null;

  const maxMatch = tail.match(/^(max|maximum)\s+(.+)$/);
  if (maxMatch) {
    if (!isThugPurchaseTerm(maxMatch[2]!)) return null;
    return { kind: 'HIRE_THUGS', mode: 'max' };
  }

  const leading = parseLeadingQuantity(tail);
  if (!leading) return null;
  if (!isThugPurchaseTerm(leading.rest)) return null;
  return { kind: 'HIRE_THUGS', mode: 'fixed', quantity: leading.quantity };
}

function tryBuyThugTail(tail: string): string | null {
  const maxMatch = tail.match(/^(max|maximum)\s+(.+)$/);
  if (maxMatch && isThugPurchaseTerm(maxMatch[2]!)) return tail;

  const leading = parseLeadingQuantity(tail);
  if (leading && isThugPurchaseTerm(leading.rest)) return tail;

  return null;
}

function parseBuy(normalized: string): WireCommand | null {
  const match = normalized.match(/^buy\s+(.+)$/);
  if (!match) return null;

  const tail = match[1]!.trim();
  if (!tail) return unknown('Missing item to buy.');

  const maxMatch = tail.match(/^(max|maximum)\s+(.+)$/);
  if (maxMatch) {
    const itemTerm = maxMatch[2]!.trim();
    if (isWorkerPurchaseTerm(itemTerm)) {
      return unknown(`${OS_TERMS.specialists} cannot be purchased from the City Shop. Use Scout to recruit personnel.`);
    }
    if (isThugPurchaseTerm(itemTerm)) {
      return { kind: 'HIRE_THUGS', mode: 'max' };
    }
    const itemKey = resolveShopItemFromPhrase(itemTerm);
    if (!itemKey) return unknown(`Unknown shop item: ${itemTerm}`);
    return { kind: 'BUY', itemKey, mode: 'max' };
  }

  const leading = parseLeadingQuantity(tail);
  if (!leading) return unknown('Could not parse buy quantity.');

  if (isWorkerPurchaseTerm(leading.rest)) {
    return unknown(`${OS_TERMS.specialists} cannot be purchased from the City Shop. Use Scout to recruit personnel.`);
  }
  if (isThugPurchaseTerm(leading.rest)) {
    return { kind: 'HIRE_THUGS', mode: 'fixed', quantity: leading.quantity };
  }

  const itemKey = resolveShopItemFromPhrase(leading.rest);
  if (!itemKey) return unknown(`Unknown shop item: ${leading.rest}`);

  return { kind: 'BUY', itemKey, mode: 'fixed', quantity: leading.quantity };
}

function parseNav(normalized: string): WireCommand | null {
  const stripped = stripNavigationPrefix(normalized);
  const href = resolveWireRoute(stripped) ?? resolveWireRoute(normalized);
  if (!href) return null;
  return { kind: 'NAV', href };
}

/** Parse raw player text into a structured THE WIRE command. Pure — no I/O. */
export function parseWireCommand(raw: string): WireCommand {
  const normalized = normalizeWireInput(raw);
  if (!normalized) return unknown('Empty command.');

  const hire = parseHireThugs(normalized);
  if (hire) return hire;

  const buy = parseBuy(normalized);
  if (buy) return buy;

  const stat = parseStat(normalized);
  if (stat) return stat;

  const nav = parseNav(normalized);
  if (nav) return nav;

  return unknown('Unrecognized command.');
}

export { isMaxQuantityKeyword };
