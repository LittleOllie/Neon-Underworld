import { ATTACK_RULES } from '@/config/game/attack-rules';

export interface WeaponInventory {
  glocks: number;
  uzis: number;
  aks: number;
}

export interface WeaponAllocation {
  glocks: number;
  uzis: number;
  aks: number;
  armedThugs: number;
  unarmedThugs: number;
  totalStrength: number;
}

/** Strongest-first: AK → Uzi → Glock, one weapon per thug. Weapons are not consumed. */
export function allocateWeaponsForThugs(
  thugCount: number,
  inventory: WeaponInventory,
): WeaponAllocation {
  if (thugCount <= 0) {
    return { glocks: 0, uzis: 0, aks: 0, armedThugs: 0, unarmedThugs: 0, totalStrength: 0 };
  }

  let remaining = thugCount;
  let aks = 0;
  let uzis = 0;
  let glocks = 0;

  const take = (available: number) => {
    const n = Math.min(available, remaining);
    remaining -= n;
    return n;
  };

  aks = take(inventory.aks);
  uzis = take(inventory.uzis);
  glocks = take(inventory.glocks);

  const armedThugs = thugCount - remaining;
  const unarmedThugs = remaining;
  const { weapons } = ATTACK_RULES;
  const totalStrength =
    aks * weapons.ak.strength +
    uzis * weapons.uzi.strength +
    glocks * weapons.glock.strength +
    unarmedThugs * weapons.unarmedStrength;

  return { glocks, uzis, aks, armedThugs, unarmedThugs, totalStrength };
}

export function weaponCoverageBand(armed: number, total: number): string {
  if (total <= 0) return 'None';
  const pct = armed / total;
  if (pct >= 0.95) return 'Fully armed';
  if (pct >= 0.6) return 'Well armed';
  if (pct >= 0.3) return 'Partially armed';
  if (pct > 0) return 'Poorly armed';
  return 'Unarmed';
}
