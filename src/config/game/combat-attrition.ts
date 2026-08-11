/** Small combat equipment loss — weapons tied to thug casualties, not uncommitted stock. */
export const COMBAT_WEAPON_ATTRITION = {
  /** Expected weapons lost ≈ casualties × rate (capped by weapons committed). */
  lossRatePerCasualty: 0.11,
  minLossOnCasualties: 0,
  maxLossFractionOfCommitted: 0.35,
} as const;
