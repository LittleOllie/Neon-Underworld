import type { DistrictSlug } from './scout-area-names';
import { getCityShopItem } from './shop-rules';

export type StreetDrugType = 'hash' | 'shrooms' | 'coke' | 'heroin';

/** Base street price before district multiplier — always below NPC shop buy. */
export const STREET_DRUG_BASE_PRICES: Record<StreetDrugType, number> = {
  hash: 4,
  shrooms: 11,
  coke: 20,
  heroin: 24,
};

/** Relative demand multipliers per district — creates travel incentive without shop arbitrage. */
export const STREET_DRUG_DISTRICT_MULTIPLIERS: Record<
  DistrictSlug,
  Record<StreetDrugType, number>
> = {
  'neon-strip': { hash: 1.1, shrooms: 1.35, coke: 1.45, heroin: 1.05 },
  docklands: { hash: 1.4, shrooms: 1.05, coke: 0.9, heroin: 1.35 },
  'old-quarter': { hash: 0.95, shrooms: 1.25, coke: 1.05, heroin: 1.55 },
};

export const STREET_DRUG_FIELD: Record<StreetDrugType, 'hash' | 'shrooms' | 'coke' | 'heroin'> = {
  hash: 'hash',
  shrooms: 'shrooms',
  coke: 'coke',
  heroin: 'heroin',
};

export const STREET_DRUG_LABELS: Record<StreetDrugType, string> = {
  hash: 'Hash',
  shrooms: 'Shrooms',
  coke: 'Coke',
  heroin: 'Heroin',
};

export function getDrugStreetPrice(districtSlug: string, drug: StreetDrugType): number {
  const mult =
    STREET_DRUG_DISTRICT_MULTIPLIERS[districtSlug as DistrictSlug]?.[drug] ?? 1;
  return Math.max(1, Math.floor(STREET_DRUG_BASE_PRICES[drug] * mult));
}

export function streetDrugDemandHint(districtSlug: string): { drug: StreetDrugType; label: string }[] {
  const mults = STREET_DRUG_DISTRICT_MULTIPLIERS[districtSlug as DistrictSlug];
  if (!mults) return [];
  const ranked = (Object.keys(mults) as StreetDrugType[])
    .map((drug) => ({ drug, mult: mults[drug] }))
    .sort((a, b) => b.mult - a.mult);
  const top = ranked[0];
  const low = ranked[ranked.length - 1];
  if (!top || !low) return [];
  return [
    { drug: top.drug, label: `${STREET_DRUG_LABELS[top.drug]} demand high` },
    { drug: low.drug, label: `${STREET_DRUG_LABELS[low.drug]} demand lower` },
  ];
}

/** Ensures street sale in any district stays below NPC shop buy (no buy→street same-city profit). */
export function validateStreetDrugPricing(): { valid: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const district of Object.keys(STREET_DRUG_DISTRICT_MULTIPLIERS) as DistrictSlug[]) {
    for (const drug of Object.keys(STREET_DRUG_BASE_PRICES) as StreetDrugType[]) {
      const street = getDrugStreetPrice(district, drug);
      const shopKey = drug === 'shrooms' ? 'shroom' : drug;
      const shop = getCityShopItem(shopKey);
      if (shop && street >= shop.shopPrice) {
        violations.push(`${district}/${drug}: street $${street} >= shop $${shop.shopPrice}`);
      }
    }
  }
  return { valid: violations.length === 0, violations };
}
