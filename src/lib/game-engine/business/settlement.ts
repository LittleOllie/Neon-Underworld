import {
  businessHourlyIncomePerWorker,
  getBusinessTypeRule,
  type BusinessType,
} from '@/config/game/business-rules';

const MS_PER_HOUR = 60 * 60 * 1000;

export interface BusinessSettlementInput {
  businessType: BusinessType;
  assignedWorkers: number;
  safeCash: number;
  lastSettledAt: Date;
  now?: Date;
}

export interface BusinessSettlementResult {
  safeCash: number;
  lastSettledAt: Date;
  incomeAccrued: number;
  safeFull: boolean;
}

/**
 * Lazy passive income settlement — accrues up to safe capacity without losing elapsed time precision.
 */
export function settleBusinessIncome(input: BusinessSettlementInput): BusinessSettlementResult {
  const now = input.now ?? new Date();
  const rule = getBusinessTypeRule(input.businessType);
  const capacity = rule.safeCapacity;

  if (
    input.assignedWorkers <= 0 ||
    input.safeCash >= capacity ||
    now.getTime() <= input.lastSettledAt.getTime()
  ) {
    return {
      safeCash: input.safeCash,
      lastSettledAt: now,
      incomeAccrued: 0,
      safeFull: input.safeCash >= capacity,
    };
  }

  const remainingCapacity = capacity - input.safeCash;
  const incomePerMs =
    (businessHourlyIncomePerWorker(input.businessType) * input.assignedWorkers) /
    MS_PER_HOUR;

  if (incomePerMs <= 0) {
    return {
      safeCash: input.safeCash,
      lastSettledAt: now,
      incomeAccrued: 0,
      safeFull: false,
    };
  }

  const elapsedMs = now.getTime() - input.lastSettledAt.getTime();
  const maxMsForCapacity = remainingCapacity / incomePerMs;
  const appliedMs = Math.min(elapsedMs, maxMsForCapacity);
  const incomeAccrued = Math.floor(incomePerMs * appliedMs);
  const newSafeCash = Math.min(capacity, input.safeCash + incomeAccrued);
  const newLastSettled = new Date(input.lastSettledAt.getTime() + appliedMs);

  return {
    safeCash: newSafeCash,
    lastSettledAt: newLastSettled,
    incomeAccrued,
    safeFull: newSafeCash >= capacity,
  };
}
