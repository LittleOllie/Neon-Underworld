/** Display-only crew scale bands — flavour copy with zero gameplay effect. */
export const EMPIRE_SCALE_BANDS = [
  { min: 0, max: 99, label: 'Small underground operation' },
  { min: 100, max: 499, label: 'Growing crew' },
  { min: 500, max: 1_999, label: 'Established operation' },
  { min: 2_000, max: 4_999, label: 'District force' },
  { min: 5_000, max: 9_999, label: 'Major underground network' },
  { min: 10_000, max: 19_999, label: 'Underworld powerhouse' },
  { min: 20_000, max: Number.POSITIVE_INFINITY, label: 'Dominant empire' },
] as const;

/** Total crew for display — not a gameplay stat. */
export function empireTotalCrew(totalWorkers: number, totalThugs: number): number {
  return totalWorkers + totalThugs;
}

export function empireScaleDescriptor(totalCrew: number): string {
  for (const band of EMPIRE_SCALE_BANDS) {
    if (totalCrew >= band.min && totalCrew <= band.max) {
      return band.label;
    }
  }
  return EMPIRE_SCALE_BANDS[EMPIRE_SCALE_BANDS.length - 1].label;
}
