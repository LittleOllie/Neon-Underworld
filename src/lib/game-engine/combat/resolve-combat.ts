import { ATTACK_RULES, ATTACK_TYPE_LABELS, type AttackType } from '@/config/game/attack-rules';
import { createCombatRng } from './combat-random';
import { allocateWeaponsForThugs } from './weapon-allocation';
import { resolveForceScores, forceEstimate } from './force-score';
import { resolveCasualties } from './casualties';
import { resolveTheft, type DrugStock } from './theft';
import { resolveWeaponAttrition, type WeaponLosses } from './weapon-attrition';
import { resolveWorkerPoach } from './worker-poach';

export interface CombatParticipant {
  thugs: number;
  glocks: number;
  uzis: number;
  aks: number;
  cash: number;
  drugs: DrugStock;
}

export interface CombatResolutionInput {
  attackType: AttackType;
  attackingThugs: number;
  attacker: CombatParticipant;
  defender: CombatParticipant;
  /** Virtual unarmed thugs from cartel mates — force only, no casualties or weapon draw */
  cartelSupportThugs?: number;
  /** Cartel-owned thugs armed from cartel weapon stock — can take casualties */
  cartelArmoury?: {
    thugs: number;
    glocks: number;
    uzis: number;
  };
  /** Worker poaching — defender workforce context (authoritative, server-only). */
  poachContext?: {
    defenderWorkers: number;
    defenderThugsForProtection: number;
    workerHappiness: number;
  };
  seed: number;
}

export interface CombatResolutionResult {
  attackType: AttackType;
  attackingThugs: number;
  attackerLosses: number;
  defenderLosses: number;
  cartelThugLosses: number;
  attackerWeaponLosses: WeaponLosses;
  defenderWeaponLosses: WeaponLosses;
  attackerReturned: number;
  cashStolen: number;
  drugsStolen: DrugStock;
  workersStolen: number;
  outcome: 'SUCCESS' | 'PARTIAL' | 'REPULSED';
  outcomeLabel: string;
  forceEstimate: string;
  attackerForceSnapshot: Record<string, unknown>;
  defenderForceSnapshot: Record<string, unknown>;
}

export function resolveCombat(input: CombatResolutionInput): CombatResolutionResult {
  const rng = createCombatRng(input.seed);

  const attackerAlloc = allocateWeaponsForThugs(input.attackingThugs, {
    glocks: input.attacker.glocks,
    uzis: input.attacker.uzis,
    aks: input.attacker.aks,
  });
  const defenderAlloc = allocateWeaponsForThugs(input.defender.thugs, {
    glocks: input.defender.glocks,
    uzis: input.defender.uzis,
    aks: input.defender.aks,
  });

  const cartelArmoury = input.cartelArmoury ?? { thugs: 0, glocks: 0, uzis: 0 };
  const cartelOwnedThugs = Math.max(0, cartelArmoury.thugs);
  const cartelAlloc = allocateWeaponsForThugs(cartelOwnedThugs, {
    glocks: cartelArmoury.glocks,
    uzis: cartelArmoury.uzis,
    aks: 0,
  });

  const cartelSupport = Math.max(0, input.cartelSupportThugs ?? 0);
  const cartelSupportStrength = cartelSupport * ATTACK_RULES.weapons.unarmedStrength;
  const defenderStrength =
    defenderAlloc.totalStrength + cartelAlloc.totalStrength + cartelSupportStrength;

  const { ratio } = resolveForceScores(attackerAlloc.totalStrength, defenderStrength, rng);

  const totalDefendingThugs = input.defender.thugs + cartelOwnedThugs;
  const casualties = resolveCasualties(
    input.attackingThugs,
    totalDefendingThugs,
    ratio,
    rng,
  );

  const playerDefenderLosses = Math.min(casualties.defenderLosses, input.defender.thugs);
  const cartelThugLosses = Math.min(
    cartelOwnedThugs,
    casualties.defenderLosses - playerDefenderLosses,
  );
  const defenderLosses = playerDefenderLosses;

  const attackerWeaponLosses = resolveWeaponAttrition(
    casualties.attackerLosses,
    attackerAlloc,
    rng,
  );
  const defenderWeaponLosses = resolveWeaponAttrition(
    playerDefenderLosses,
    defenderAlloc,
    rng,
  );

  const attackerReturned = Math.max(0, input.attackingThugs - casualties.attackerLosses);
  const theft = resolveTheft(
    input.attackType,
    casualties.attackerVictory,
    casualties.tacticalSuccess,
    input.defender.cash,
    input.defender.drugs,
    attackerReturned,
    input.attackingThugs,
    rng,
  );

  let workersStolen = 0;
  let poachStrong = false;
  if (input.attackType === 'POACH_WORKERS' && input.poachContext) {
    const poach = resolveWorkerPoach({
      attackerVictory: casualties.attackerVictory,
      tacticalSuccess: casualties.tacticalSuccess,
      defenderWorkers: input.poachContext.defenderWorkers,
      defenderThugsForProtection: input.poachContext.defenderThugsForProtection,
      workerHappiness: input.poachContext.workerHappiness,
      survivingAttackers: attackerReturned,
      attackingThugs: input.attackingThugs,
      rng,
    });
    workersStolen = poach.workersStolen;
    poachStrong = poach.strongSuccess;
  }

  let outcome: CombatResolutionResult['outcome'];
  let outcomeLabel: string;

  if (input.attackType === 'DRIVE_BY') {
    if (casualties.attackerVictory && casualties.defenderLosses > 0) {
      outcome = 'SUCCESS';
      outcomeLabel = 'Drive-by complete — you won the clash and inflicted damage.';
    } else if (casualties.attackerVictory) {
      outcome = 'PARTIAL';
      outcomeLabel = 'Drive-by broke through — defenders held with no losses.';
    } else {
      outcome = 'REPULSED';
      outcomeLabel = 'Drive-by repelled — defenders held the line.';
    }
  } else if (input.attackType === 'POACH_WORKERS') {
    if (!casualties.attackerVictory) {
      outcome = 'REPULSED';
      outcomeLabel = 'Poach attempt failed — their crew refused to move.';
    } else if (workersStolen > 0) {
      outcome = 'SUCCESS';
      outcomeLabel = poachStrong
        ? `Workers poached — ${workersStolen.toLocaleString()} joined your operation.`
        : `Workers poached — ${workersStolen.toLocaleString()} transferred to your crew.`;
    } else {
      outcome = 'PARTIAL';
      outcomeLabel = 'Poach attempt repelled — defenders stopped the workforce transfer.';
    }
  } else if (casualties.attackerVictory && (theft.cashStolen > 0 || totalDrugs(theft.drugsStolen) > 0)) {
    outcome = 'SUCCESS';
    outcomeLabel = `${ATTACK_TYPE_LABELS[input.attackType]} successful.`;
  } else if (casualties.attackerVictory) {
    outcome = 'PARTIAL';
    outcomeLabel = `${ATTACK_TYPE_LABELS[input.attackType]} partial — defenders damaged, no assets taken.`;
  } else {
    outcome = 'REPULSED';
    outcomeLabel = `${ATTACK_TYPE_LABELS[input.attackType]} repelled.`;
  }

  return {
    attackType: input.attackType,
    attackingThugs: input.attackingThugs,
    attackerLosses: casualties.attackerLosses,
    defenderLosses,
    cartelThugLosses,
    attackerWeaponLosses,
    defenderWeaponLosses,
    attackerReturned,
    cashStolen: theft.cashStolen,
    drugsStolen: theft.drugsStolen,
    workersStolen,
    outcome,
    outcomeLabel,
    forceEstimate: forceEstimate(attackerAlloc.totalStrength, defenderStrength),
    attackerForceSnapshot: {
      allocation: attackerAlloc,
      thugsSent: input.attackingThugs,
    },
    defenderForceSnapshot: {
      allocation: defenderAlloc,
      thugsDefending: input.defender.thugs,
      cartelSupportThugs: cartelSupport,
      cartelArmouryThugs: cartelOwnedThugs,
      cartelArmouryAllocation: cartelAlloc,
      cartelThugLosses,
    },
  };
}

function totalDrugs(d: DrugStock): number {
  return d.hash + d.shrooms + d.coke + d.heroin;
}

export function deriveCombatSeed(attackerId: string, defenderId: string, idempotencyKey: string): number {
  let h = 0;
  const s = `${attackerId}:${defenderId}:${idempotencyKey}`;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}
