import { ATTACK_RULES, ATTACK_TYPE_LABELS, type AttackType } from '@/config/game/attack-rules';
import { createCombatRng } from './combat-random';
import { allocateWeaponsForThugs } from './weapon-allocation';
import { resolveForceScores, forceEstimate } from './force-score';
import { resolveCasualties } from './casualties';
import { resolveTheft, type DrugStock } from './theft';

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
  seed: number;
}

export interface CombatResolutionResult {
  attackType: AttackType;
  attackingThugs: number;
  attackerLosses: number;
  defenderLosses: number;
  attackerReturned: number;
  cashStolen: number;
  drugsStolen: DrugStock;
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

  const cartelSupport = Math.max(0, input.cartelSupportThugs ?? 0);
  const cartelSupportStrength = cartelSupport * ATTACK_RULES.weapons.unarmedStrength;
  const defenderStrength = defenderAlloc.totalStrength + cartelSupportStrength;

  const { ratio } = resolveForceScores(attackerAlloc.totalStrength, defenderStrength, rng);

  const casualties = resolveCasualties(
    input.attackingThugs,
    input.defender.thugs,
    ratio,
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

  let outcome: CombatResolutionResult['outcome'];
  let outcomeLabel: string;

  if (input.attackType === 'DRIVE_BY') {
    if (casualties.defenderLosses > casualties.attackerLosses) {
      outcome = casualties.attackerVictory ? 'SUCCESS' : 'PARTIAL';
      outcomeLabel = 'Drive-by complete — significant damage inflicted.';
    } else {
      outcome = 'REPULSED';
      outcomeLabel = 'Drive-by repelled — limited damage.';
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
    defenderLosses: casualties.defenderLosses,
    attackerReturned,
    cashStolen: theft.cashStolen,
    drugsStolen: theft.drugsStolen,
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
