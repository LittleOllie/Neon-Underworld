import type { EmpireManagementData } from '@local/domain/empire.model';

/** Display-only compact currency for empire summary rows. */
export function formatEmpireSummaryMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) {
    const m = amount / 1_000_000;
    return `$${m.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs >= 10_000) {
    const k = amount / 1_000;
    return `$${k.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function empireStreetDrugUnits(drugs: EmpireManagementData['drugs']): number {
  return drugs.byType.reduce((sum, drug) => sum + drug.quantity, 0);
}

export function empireWeaponCount(weapons: EmpireManagementData['weapons']): number {
  return weapons.byType.reduce((sum, weapon) => sum + weapon.quantity, 0);
}

export function empireGearHeaderBadge(
  weapons: EmpireManagementData['weapons'],
  vehicles: EmpireManagementData['vehicles'],
): string {
  const weaponCount = empireWeaponCount(weapons);
  const rides = vehicles.totalVehicles;
  return `${weaponCount.toLocaleString()} WEAPONS · ${rides.toLocaleString()} RIDES`;
}

export function empireBusinessesOwned(data: EmpireManagementData): number {
  return data.businessOperations?.owned ?? data.businesses.total ?? 0;
}

export function empireWorkersHeaderBadge(totalWorkers: number): string {
  return `${totalWorkers.toLocaleString()} TOTAL`;
}

export function empireThugsHeaderBadge(totalThugs: number): string {
  return `${totalThugs.toLocaleString()} TOTAL`;
}

export function empireDrugsHeaderBadge(streetUnits: number): string {
  return `${streetUnits.toLocaleString()} STREET UNITS`;
}

export function empireBusinessesHeaderBadge(owned: number): string {
  return `${owned.toLocaleString()} OWNED`;
}
