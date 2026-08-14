import { CITY_SHOP_ITEMS, type ShopItemKey } from '@core/config/game/shop-rules';

/** Extra player-facing terms mapped to canonical shop keys — prices stay in CITY_SHOP_ITEMS. */
const EXTRA_SHOP_ALIASES: Record<string, ShopItemKey> = {
  glocks: 'glock',
  uzis: 'uzi',
  aks: 'ak',
  ak47: 'ak',
  ak47s: 'ak',
  rides: 'ride',
  car: 'ride',
  cars: 'ride',
  vehicle: 'ride',
  vehicles: 'ride',
  condoms: 'condom',
  beers: 'beer',
  shrooms: 'shroom',
  mushroom: 'shroom',
  mushrooms: 'shroom',
  cocaine: 'coke',
};

const WORKER_TERMS = new Set([
  'worker',
  'workers',
  'whore',
  'whores',
  'prostitute',
  'prostitutes',
]);

const THUG_TERMS = new Set(['thug', 'thugs']);

function normalizeAliasToken(token: string): string {
  return token.toLowerCase().replace(/-/g, '').trim();
}

function buildAliasMap(): Map<string, ShopItemKey> {
  const map = new Map<string, ShopItemKey>();

  for (const item of CITY_SHOP_ITEMS) {
    map.set(normalizeAliasToken(item.key), item.key);
    map.set(normalizeAliasToken(item.displayName), item.key);
    map.set(normalizeAliasToken(item.displayName.replace(/-/g, ' ')), item.key);
    map.set(normalizeAliasToken(item.displayName.replace(/-/g, '')), item.key);
  }

  for (const [alias, key] of Object.entries(EXTRA_SHOP_ALIASES)) {
    map.set(normalizeAliasToken(alias), key);
  }

  return map;
}

export const SHOP_ITEM_ALIAS_MAP = buildAliasMap();

export function resolveShopItemKey(term: string): ShopItemKey | null {
  const normalized = normalizeAliasToken(term);
  if (!normalized) return null;
  return SHOP_ITEM_ALIAS_MAP.get(normalized) ?? null;
}

export function resolveShopItemFromPhrase(phrase: string): ShopItemKey | null {
  const trimmed = phrase.trim();
  if (!trimmed) return null;

  const direct = resolveShopItemKey(trimmed);
  if (direct) return direct;

  const collapsed = trimmed.replace(/\s+/g, '');
  return resolveShopItemKey(collapsed);
}

export function isWorkerPurchaseTerm(term: string): boolean {
  return WORKER_TERMS.has(normalizeAliasToken(term));
}

export function isThugPurchaseTerm(term: string): boolean {
  return THUG_TERMS.has(normalizeAliasToken(term));
}

export function listSupportedShopAliases(): string[] {
  return [...SHOP_ITEM_ALIAS_MAP.keys()].sort();
}
