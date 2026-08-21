import type { EmpireManagementData } from '@local/domain/empire.model';
import { OS_TERMS, resourceLabel, type ResourceDisplayKey } from '@local/config/terminology';

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

export function empireWorkersPreviewLines(data: EmpireManagementData): string[] {
  const morale = Math.round(data.statusMeters.worker.stability.value);
  return [
    `${data.personnel.streetWorkers.toLocaleString()} Active · ${data.personnel.businessWorkers.toLocaleString()} Business`,
    `Morale ${morale}%`,
  ];
}

export function empireThugsPreviewLines(data: EmpireManagementData): string[] {
  const morale = Math.round(data.statusMeters.thug.stability.value);
  const weapons = empireWeaponCount(data.weapons);
  const rides = data.vehicles.totalVehicles;
  return [
    `${data.personnel.streetThugs.toLocaleString()} Active · ${data.personnel.businessSecurity.toLocaleString()} Business`,
    `${weapons.toLocaleString()} Weapons · ${rides.toLocaleString()} Rides`,
    `Morale ${morale}%`,
  ];
}

export function empireDrugsPreviewLines(drugs: EmpireManagementData['drugs']): string[] {
  const stocked = drugs.byType.filter((d) => d.quantity > 0);
  if (stocked.length === 0) {
    return ['No technology stock on hand'];
  }
  const breakdown = stocked
    .slice(0, 4)
    .map((d) => {
      const label =
        d.key === 'hash' || d.key === 'shrooms' || d.key === 'coke' || d.key === 'heroin'
          ? resourceLabel(d.key as ResourceDisplayKey)
          : d.name;
      return `${label} ${d.quantity.toLocaleString()}`;
    })
    .join(' · ');
  return [breakdown];
}

export function empireGearPreviewLines(data: EmpireManagementData): string[] {
  const weapons = empireWeaponCount(data.weapons);
  const rides = data.vehicles.totalVehicles;
  if (rides === 0) {
    return [`${weapons.toLocaleString()} armed units`, 'No rides in fleet'];
  }
  return [`${weapons.toLocaleString()} weapons ready`, `${rides.toLocaleString()} rides available`];
}

export function empireBusinessesPreviewLines(data: EmpireManagementData): string[] {
  const owned = empireBusinessesOwned(data);
  if (owned === 0) {
    return ['No legitimate fronts yet'];
  }
  const ops = data.businessOperations;
  return [`${(ops?.assignedWorkers ?? 0).toLocaleString()} ${OS_TERMS.specialists.toLowerCase()} assigned`];
}

export type EmpireSectionMetric = {
  value: string;
  label: string;
  subLabel?: string;
};

export function empireWorkersMetric(totalWorkers: number): EmpireSectionMetric {
  return { value: totalWorkers.toLocaleString(), label: OS_TERMS.workers.toUpperCase() };
}

export function empireThugsMetric(totalThugs: number): EmpireSectionMetric {
  return { value: totalThugs.toLocaleString(), label: OS_TERMS.thugs.toUpperCase() };
}

export function empireDrugsMetric(streetUnits: number): EmpireSectionMetric {
  return { value: streetUnits.toLocaleString(), label: 'TECH UNITS' };
}

export function empireGearMetric(
  weapons: EmpireManagementData['weapons'],
  vehicles: EmpireManagementData['vehicles'],
): EmpireSectionMetric {
  const weaponCount = empireWeaponCount(weapons);
  const rides = vehicles.totalVehicles;
  return {
    value: weaponCount.toLocaleString(),
    label: 'WEAPONS',
    subLabel: rides > 0 ? `${rides.toLocaleString()} RIDES` : undefined,
  };
}

export function empireBusinessesMetric(owned: number): EmpireSectionMetric {
  return { value: owned.toLocaleString(), label: 'OWNED' };
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
  return `${totalWorkers.toLocaleString()} ${OS_TERMS.workers.toUpperCase()}`;
}

export function empireThugsHeaderBadge(totalThugs: number): string {
  return `${totalThugs.toLocaleString()} ${OS_TERMS.thugs.toUpperCase()}`;
}

export function empireDrugsHeaderBadge(streetUnits: number): string {
  return `${streetUnits.toLocaleString()} TECH UNITS`;
}

export function empireBusinessesHeaderBadge(owned: number): string {
  return owned === 0 ? '0 OWNED' : `${owned.toLocaleString()} OWNED`;
}
