export { isWithinAttackRange, REDLITE_ATTACK } from '@/config/game/redlite-rules';
export { REDLITE_VEHICLES, REDLITE_WEAPONS } from '@/config/game/redlite-rules';

/** Rides required to move thugs on an attack (1 ride per 5 thugs) */
export function ridesRequiredForThugs(thugCount: number, thugsPerRide = 5): number {
  if (thugCount <= 0) return 0;
  return Math.ceil(thugCount / thugsPerRide);
}

/** Whether attacker thugs exceed defender thugs + cartel thugs */
export function canWinDriveBy(
  attackerThugs: number,
  defenderThugs: number,
  defenderCartelThugs: number,
): boolean {
  return attackerThugs > defenderThugs + defenderCartelThugs;
}
