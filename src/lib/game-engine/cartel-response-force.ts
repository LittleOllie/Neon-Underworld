/** Cartel Response Force v2 — personal progression + pool share + transport caps. */

export const CARTEL_RESPONSE_PERSONAL_MIN_ALLOWANCE = 25;
export const CARTEL_RESPONSE_PERSONAL_MULTIPLIER = 2;
export const CARTEL_RESPONSE_POOL_SHARE = 0.25;
export const CARTEL_THUGS_PER_RIDE = 5;
export const CARTEL_LOCAL_SUPPORT_FRACTION = 0.1;

/**
 * Maximum organised cartel thugs that may deploy to defend one member.
 * Minimum allowance (25) is not guaranteed — limited by current pool, 25% cap, and rides.
 */
export function computeCartelResponseForce(
  defenderPersonalThugs: number,
  currentCartelThugs: number,
  cartelRides: number,
): number {
  const pool = Math.max(0, Math.floor(currentCartelThugs));
  const rides = Math.max(0, Math.floor(cartelRides));
  const rideCapacity = rides * CARTEL_THUGS_PER_RIDE;

  if (rideCapacity <= 0 || pool <= 0) return 0;

  const personal = Math.max(0, Math.floor(defenderPersonalThugs));
  const personalAllowance = Math.max(
    CARTEL_RESPONSE_PERSONAL_MIN_ALLOWANCE,
    personal * CARTEL_RESPONSE_PERSONAL_MULTIPLIER,
  );
  const cartelShareCap = Math.floor(pool * CARTEL_RESPONSE_POOL_SHARE);

  return Math.min(personalAllowance, cartelShareCap, pool, rideCapacity);
}
