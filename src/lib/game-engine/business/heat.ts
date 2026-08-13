import {
  BUSINESS_HEAT_BANDS,
  BUSINESS_TYPE_RULES,
  businessDrugStorageTotal,
  businessWeightedDrugUnits,
  getBusinessLevelStats,
  type BusinessDrugKey,
  type BusinessHeatBand,
  type BusinessType,
} from '@/config/game/business-rules';
import { securityHeatContribution } from '@/lib/game-engine/business/security';

export interface BusinessHeatInput {
  businessType: BusinessType;
  level: number;
  assignedWorkers: number;
  assignedThugs?: number;
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

export function evaluateBusinessHeat(input: BusinessHeatInput): BusinessHeatResult {
  const rule = BUSINESS_TYPE_RULES[input.businessType];
  const levelStats = getBusinessLevelStats(input.businessType, input.level);
  const capacity = levelStats.drugStorageCapacity;
  const totalUnits = businessDrugStorageTotal(input.stored);
  const fillRatio = capacity > 0 ? Math.min(1, totalUnits / capacity) : 0;
  const weightedUnits = businessWeightedDrugUnits(
    input.stored,
    levelStats.premiumDrugHeatMultiplier,
  );
  const weightedFill =
    capacity > 0 ? Math.min(1, weightedUnits / (capacity * 2)) : 0;

  const storageReduction = levelStats.storageHeatReduction;
  const drugHeat = weightedFill * 45 * (1 - storageReduction);
  const safeRatio =
    levelStats.safeCapacity > 0
      ? Math.min(1, input.safeCash / levelStats.safeCapacity)
      : 0;
  const cashHeat = safeRatio * 12;
  const workerHeat = Math.min(10, (input.assignedWorkers / 500) * 10);
  const securityHeat = securityHeatContribution(
    input.assignedThugs ?? 0,
    levelStats.securityCapacity,
  );

  const score = Math.min(
    100,
    rule.baseHeat +
      drugHeat +
      cashHeat +
      workerHeat +
      fillRatio * 5 * (1 - storageReduction) +
      securityHeat,
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
