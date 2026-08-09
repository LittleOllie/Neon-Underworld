import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';
import type { CombatRng } from './combat-random';

export interface DrugStock {
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
}

export interface TheftResult {
  cashStolen: number;
  drugsStolen: DrugStock;
}

export function resolveTheft(
  attackType: AttackType,
  attackerVictory: boolean,
  tacticalSuccess: boolean,
  defenderCash: number,
  defenderDrugs: DrugStock,
  survivingAttackers: number,
  attackingThugs: number,
  rng: CombatRng,
): TheftResult {
  const empty: DrugStock = { hash: 0, shrooms: 0, coke: 0, heroin: 0 };
  if (!attackerVictory) {
    return { cashStolen: 0, drugsStolen: empty };
  }

  const survivalRatio = attackingThugs > 0 ? survivingAttackers / attackingThugs : 0;

  if (attackType === 'DRIVE_BY') {
    return { cashStolen: 0, drugsStolen: empty };
  }

  if (attackType === 'HOME_INVASION') {
    if (!tacticalSuccess || defenderCash <= 0 || survivalRatio < 0.3) {
      return { cashStolen: 0, drugsStolen: empty };
    }
    const { cashTheftBasePercent, cashTheftMaxPercent } = ATTACK_RULES;
    const pct = cashTheftBasePercent + rng.next() * (cashTheftMaxPercent - cashTheftBasePercent);
    const scaled = pct * survivalRatio;
    const cashStolen = Math.min(defenderCash, Math.floor(defenderCash * scaled));
    return { cashStolen: Math.max(0, cashStolen), drugsStolen: empty };
  }

  // RAID_DRUG_LABS — proportional across stock
  const totalDrugs =
    defenderDrugs.hash + defenderDrugs.shrooms + defenderDrugs.coke + defenderDrugs.heroin;
  if (!tacticalSuccess || totalDrugs <= 0 || survivalRatio < 0.3) {
    return { cashStolen: 0, drugsStolen: empty };
  }

  const { drugTheftBasePercent, drugTheftMaxPercent } = ATTACK_RULES;
  const pct = drugTheftBasePercent + rng.next() * (drugTheftMaxPercent - drugTheftBasePercent);
  const stealTotal = Math.floor(totalDrugs * pct * survivalRatio);
  if (stealTotal <= 0) {
    return { cashStolen: 0, drugsStolen: empty };
  }

  const drugsStolen = proportionalDrugTheft(defenderDrugs, stealTotal);
  return { cashStolen: 0, drugsStolen };
}

function proportionalDrugTheft(stock: DrugStock, stealTotal: number): DrugStock {
  const total = stock.hash + stock.shrooms + stock.coke + stock.heroin;
  if (total <= 0 || stealTotal <= 0) {
    return { hash: 0, shrooms: 0, coke: 0, heroin: 0 };
  }

  let remaining = stealTotal;
  const raw = {
    hash: Math.floor((stock.hash / total) * stealTotal),
    shrooms: Math.floor((stock.shrooms / total) * stealTotal),
    coke: Math.floor((stock.coke / total) * stealTotal),
    heroin: Math.floor((stock.heroin / total) * stealTotal),
  };
  const allocated = raw.hash + raw.shrooms + raw.coke + raw.heroin;
  remaining = stealTotal - allocated;

  const keys = (['hash', 'shrooms', 'coke', 'heroin'] as Array<keyof DrugStock>).sort(
    (a, b) => stock[b] - stock[a],
  );
  for (const key of keys) {
    while (remaining > 0 && raw[key] < stock[key]) {
      raw[key]++;
      remaining--;
    }
  }

  return raw;
}
