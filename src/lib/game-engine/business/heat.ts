import {
  BUSINESS_HEAT_BANDS,
  BUSINESS_TYPE_RULES,
  businessDrugStorageTotal,
  businessWeightedDrugUnits,
  type BusinessDrugKey,
  type BusinessHeatBand,
  type BusinessType,
} from '@/config/game/business-rules';

export interface BusinessHeatInput {
  businessType: BusinessType;
  assignedWorkers: number;
  safeCash: number;
  stored: Record<BusinessDrugKey, number>;
}

export interface BusinessHeatResult {
  score: number;
  band: BusinessHeatBand;
  label: string;
}

function heatBandFromScore(score: number): BusinessHeatBand {
  const clamped = Math.max(0, Math.min(100, Math.floor(score)));
  if (clamped <= BUSINESS_HEAT_BANDS.LOW.max) return 'LOW';
  if (clamped <= BUSINESS_HEAT_BANDS.MODERATE.max) return 'MODERATE';
  if (clamped <= BUSINESS_HEAT_BANDS.HIGH.max) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Derived heat from current business state — no decay ledger.
 * Drug fill is the dominant contributor; cash and workers add smaller pressure.
 */
export function evaluateBusinessHeat(input: BusinessHeatInput): BusinessHeatResult {
  const rule = BUSINESS_TYPE_RULES[input.businessType];
  const capacity = rule.drugStorageCapacity;
  const totalUnits = businessDrugStorageTotal(input.stored);
  const fillRatio = capacity > 0 ? Math.min(1, totalUnits / capacity) : 0;
  const weightedUnits = businessWeightedDrugUnits(input.stored);
  const weightedFill =
    capacity > 0 ? Math.min(1, weightedUnits / (capacity * 2)) : 0;

  const drugHeat = weightedFill * 45;
  const safeRatio =
    rule.safeCapacity > 0 ? Math.min(1, input.safeCash / rule.safeCapacity) : 0;
  const cashHeat = safeRatio * 12;
  const workerHeat = Math.min(10, (input.assignedWorkers / 500) * 10);

  const score = Math.min(
    100,
    rule.baseHeat + drugHeat + cashHeat + workerHeat + fillRatio * 5,
  );

  const band = heatBandFromScore(score);
  return {
    score,
    band,
    label: BUSINESS_HEAT_BANDS[band].label,
  };
}

export function overallHeatBand(scores: number[]): BusinessHeatBand {
  if (scores.length === 0) return 'LOW';
  const max = Math.max(...scores);
  return heatBandFromScore(max);
}
