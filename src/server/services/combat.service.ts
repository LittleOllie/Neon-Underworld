import { prisma } from '@/lib/db/prisma';
import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';
import {
  validateAttackEligibilityCode,
  ridesRequired,
  type PlayerIntelSnapshot,
} from '@/lib/game-engine/combat/eligibility';
import { allocateWeaponsForThugs, weaponCoverageBand } from '@/lib/game-engine/combat/weapon-allocation';
import { deriveCombatSeed, resolveCombat } from '@/lib/game-engine/combat/resolve-combat';
import {
  consumeTurns,
  resolveCanonicalTurnState,
  settleTurnRegeneration,
} from '@/lib/game-engine/turns';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';

export interface CombatPlayerRecord {
  id: string;
  alias: string;
  cash: number;
  bankCash: number;
  thugs: number;
  prostitutes: number;
  rides: number;
  glocks: number;
  uzis: number;
  aks: number;
  hash: number;
  shrooms: number;
  coke: number;
  heroin: number;
  businesses: number;
  lifeStatus: string;
  travelling: boolean;
  cartelId: string | null;
  district: { name: string };
  seasonId: string;
  season: { status: string };
  turnState: {
    currentTurns: number;
    lastRegeneratedAt: Date;
    turnCap: number;
    regenerationRate: number;
  };
}

export interface CombatResolutionOutput {
  encounterId: string;
  attackType: AttackType;
  outcome: string;
  outcomeLabel: string;
  attackingThugs: number;
  attackerLosses: number;
  defenderLosses: number;
  attackerReturned: number;
  cashStolen: number;
  drugsStolen: { hash: number; shrooms: number; coke: number; heroin: number };
  turnsSpent: number;
  ridesUsed: number;
  weaponCoverage: string;
  forceEstimate: string;
  targetAlias: string;
  targetPlayerId: string;
  scoutReportId: string;
  scoutConfidence: number;
  newTurns: number;
  attackerForceSnapshot: Record<string, unknown>;
  defenderForceSnapshot: Record<string, unknown>;
  defenderThugsBefore: number;
  idempotentReplay: boolean;
}

export type NetWorthCalculator = (player: CombatPlayerRecord) => number;

function parseIntelFromReport(metadata: unknown): PlayerIntelSnapshot | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as { type?: string; intel?: PlayerIntelSnapshot };
  if (m.type !== 'PLAYER_INTEL' || !m.intel) return null;
  return m.intel;
}

export async function countAttacksOnTargetLast24h(
  attackerId: string,
  defenderId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.combatEncounter.count({
    where: { attackerId, defenderId, createdAt: { gte: since } },
  });
}

export async function resolveAttackEncounter(
  attackerId: string,
  userId: string,
  scoutReportId: string,
  attackType: AttackType,
  attackingThugs: number,
  idempotencyKey: string,
  calculateNetWorth: NetWorthCalculator,
): Promise<CombatResolutionOutput> {
  const existing = await prisma.combatEncounter.findUnique({
    where: { attackerId_idempotencyKey: { attackerId, idempotencyKey } },
    include: { defender: { select: { alias: true, id: true } } },
  });

  if (existing) {
    const intelReport = await prisma.report.findFirst({ where: { id: scoutReportId, playerId: attackerId } });
    const intel = parseIntelFromReport(intelReport?.metadata);
    const attackerTurnState = await prisma.playerTurnState.findUnique({ where: { playerId: attackerId } });
    const settledTurns = attackerTurnState
      ? settleTurnRegeneration(
          resolveCanonicalTurnState({
            currentTurns: attackerTurnState.currentTurns,
            lastRegeneratedAt: attackerTurnState.lastRegeneratedAt,
            turnCap: attackerTurnState.turnCap,
            regenerationRatePerMs: attackerTurnState.regenerationRate,
          }),
        ).currentTurns
      : 0;
    return {
      encounterId: existing.id,
      attackType: existing.attackType as AttackType,
      outcome: existing.outcome,
      outcomeLabel: existing.outcome,
      attackingThugs: existing.attackingThugs,
      attackerLosses: existing.attackerLosses,
      defenderLosses: existing.defenderLosses,
      attackerReturned: existing.attackerReturned,
      cashStolen: existing.cashStolen,
      drugsStolen: (existing.drugsStolen as CombatResolutionOutput['drugsStolen']) ?? {
        hash: 0,
        shrooms: 0,
        coke: 0,
        heroin: 0,
      },
      turnsSpent: existing.turnsSpent,
      /** Rides committed/required for this attack — transport capacity, not consumed. */
      ridesUsed: existing.ridesUsed,
      weaponCoverage: '',
      forceEstimate: '',
      targetAlias: existing.defender.alias,
      targetPlayerId: existing.defenderId,
      scoutReportId,
      scoutConfidence: intel?.confidencePercent ?? 0,
      newTurns: settledTurns,
      attackerForceSnapshot: existing.attackerForceSnapshot as Record<string, unknown>,
      defenderForceSnapshot: existing.defenderForceSnapshot as Record<string, unknown>,
      defenderThugsBefore: (existing.defenderForceSnapshot as { thugsDefending?: number })?.thugsDefending ?? 0,
      idempotentReplay: true,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const attacker = await tx.player.findUniqueOrThrow({
      where: { id: attackerId },
      include: { turnState: true, district: true, season: true },
    });
    if (!attacker.turnState) throw new Error('Turn state missing');
    if (attacker.season.status !== 'ACTIVE') throw new SeasonInactiveError();

    const report = await tx.report.findFirst({
      where: { id: scoutReportId, playerId: attackerId },
    });
    if (!report) throw new GameplayError('INVALID_INTEL');
    const intel = parseIntelFromReport(report.metadata);
    if (!intel) throw new GameplayError('INVALID_INTEL');

    const defender = await tx.player.findUniqueOrThrow({
      where: { id: intel.targetPlayerId },
      include: { district: true, season: true, turnState: true },
    });

    const attackerRecord = attacker as unknown as CombatPlayerRecord;
    const defenderRecord = defender as unknown as CombatPlayerRecord;

    const attackerNw = calculateNetWorth(attackerRecord);
    const defenderNw = calculateNetWorth(defenderRecord);

    const settled = settleTurnRegeneration(
      resolveCanonicalTurnState({
        currentTurns: attacker.turnState.currentTurns,
        lastRegeneratedAt: attacker.turnState.lastRegeneratedAt,
        turnCap: attacker.turnState.turnCap,
        regenerationRatePerMs: attacker.turnState.regenerationRate,
      }),
    );

    const attacksOnTarget = await tx.combatEncounter.count({
      where: {
        attackerId,
        defenderId: defender.id,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const eligibilityCode = validateAttackEligibilityCode({
      attackerId,
      defenderId: defender.id,
      attackType,
      attackingThugs,
      attackerNw,
      defenderNw,
      attackerTurns: settled.currentTurns,
      attackerThugs: attacker.thugs,
      attackerRides: attacker.rides,
      attackerLifeStatus: attacker.lifeStatus,
      attackerTravelling: attacker.travelling,
      defenderLifeStatus: defender.lifeStatus,
      defenderTravelling: defender.travelling,
      intelReport: intel,
      attacksOnTargetLast24h: attacksOnTarget,
    });
    if (eligibilityCode) throw new GameplayError(eligibilityCode);

    const turnCost = ATTACK_RULES.turnCosts[attackType];
    const { newState: turnStateAfter } = consumeTurns(settled, turnCost);

    const defenderThugsBefore = defender.thugs;
    const seed = deriveCombatSeed(attackerId, defender.id, idempotencyKey);
    const combat = resolveCombat({
      attackType,
      attackingThugs,
      seed,
      attacker: {
        thugs: attacker.thugs,
        glocks: attacker.glocks,
        uzis: attacker.uzis,
        aks: attacker.aks,
        cash: attacker.cash,
        drugs: {
          hash: attacker.hash,
          shrooms: attacker.shrooms,
          coke: attacker.coke,
          heroin: attacker.heroin,
        },
      },
      defender: {
        thugs: defender.thugs,
        glocks: defender.glocks,
        uzis: defender.uzis,
        aks: defender.aks,
        cash: defender.cash,
        drugs: {
          hash: defender.hash,
          shrooms: defender.shrooms,
          coke: defender.coke,
          heroin: defender.heroin,
        },
      },
    });

    /** Rides committed/required for this attack — transport capacity, not consumed. */
    const ridesUsed = ridesRequired(attackingThugs);
    const attackerAlloc = allocateWeaponsForThugs(attackingThugs, {
      glocks: attacker.glocks,
      uzis: attacker.uzis,
      aks: attacker.aks,
    });

    const updatedAttacker = await tx.player.update({
      where: { id: attackerId },
      data: {
        thugs: Math.max(0, attacker.thugs - combat.attackerLosses),
        cash: attacker.cash + combat.cashStolen,
        hash: attacker.hash + combat.drugsStolen.hash,
        shrooms: attacker.shrooms + combat.drugsStolen.shrooms,
        coke: attacker.coke + combat.drugsStolen.coke,
        heroin: attacker.heroin + combat.drugsStolen.heroin,
      },
    });

    await tx.player.update({
      where: { id: defender.id },
      data: {
        thugs: Math.max(0, defender.thugs - combat.defenderLosses),
        cash: Math.max(0, defender.cash - combat.cashStolen),
        hash: Math.max(0, defender.hash - combat.drugsStolen.hash),
        shrooms: Math.max(0, defender.shrooms - combat.drugsStolen.shrooms),
        coke: Math.max(0, defender.coke - combat.drugsStolen.coke),
        heroin: Math.max(0, defender.heroin - combat.drugsStolen.heroin),
      },
    });

    await tx.playerTurnState.update({
      where: { playerId: attackerId },
      data: {
        currentTurns: turnStateAfter.currentTurns,
        lastRegeneratedAt: turnStateAfter.lastRegeneratedAt,
        turnCap: turnStateAfter.turnCap,
        regenerationRate: turnStateAfter.regenerationRatePerMs,
      },
    });

    const encounter = await tx.combatEncounter.create({
      data: {
        idempotencyKey,
        attackerId,
        defenderId: defender.id,
        scoutReportId,
        attackType,
        turnsSpent: turnCost,
        attackingThugs,
        ridesUsed,
        attackerForceSnapshot: combat.attackerForceSnapshot as object,
        defenderForceSnapshot: combat.defenderForceSnapshot as object,
        attackerLosses: combat.attackerLosses,
        defenderLosses: combat.defenderLosses,
        attackerReturned: combat.attackerReturned,
        cashStolen: combat.cashStolen,
        drugsStolen: combat.drugsStolen as object,
        outcome: combat.outcome,
      },
    });

    await tx.gameAction.create({
      data: {
        playerId: attackerId,
        seasonId: attacker.seasonId,
        actionType: 'ATTACK',
        idempotencyKey,
        requestPayload: { scoutReportId, attackType, attackingThugs } as object,
        resultPayload: { encounterId: encounter.id } as object,
        turnsSpent: turnCost,
      },
    });

    await tx.economicAuditLog.create({
      data: {
        playerId: attackerId,
        userId,
        eventType: 'ATTACK',
        source: 'combat',
        beforeState: snapshotPlayerState(attacker) as object,
        delta: {
          thugs: -combat.attackerLosses,
          cash: combat.cashStolen,
          hash: combat.drugsStolen.hash,
          shrooms: combat.drugsStolen.shrooms,
          coke: combat.drugsStolen.coke,
          heroin: combat.drugsStolen.heroin,
        },
        afterState: snapshotPlayerState(updatedAttacker) as object,
        metadata: { encounterId: encounter.id, defenderId: defender.id },
      },
    });

    return {
      encounter,
      combat,
      defender,
      turnStateAfter,
      attackerAlloc,
      intel,
      defenderThugsBefore,
    };
  }, { isolationLevel: 'Serializable' });

  return {
    encounterId: result.encounter.id,
    attackType,
    outcome: result.combat.outcome,
    outcomeLabel: result.combat.outcomeLabel,
    attackingThugs,
    attackerLosses: result.combat.attackerLosses,
    defenderLosses: result.combat.defenderLosses,
    attackerReturned: result.combat.attackerReturned,
    cashStolen: result.combat.cashStolen,
    drugsStolen: result.combat.drugsStolen,
    turnsSpent: ATTACK_RULES.turnCosts[attackType],
    ridesUsed: ridesRequired(attackingThugs),
    weaponCoverage: weaponCoverageBand(result.attackerAlloc.armedThugs, attackingThugs),
    forceEstimate: result.combat.forceEstimate,
    targetAlias: result.defender.alias,
    targetPlayerId: result.defender.id,
    scoutReportId,
    scoutConfidence: result.intel.confidencePercent,
    newTurns: result.turnStateAfter.currentTurns,
    attackerForceSnapshot: result.combat.attackerForceSnapshot,
    defenderForceSnapshot: result.combat.defenderForceSnapshot,
    defenderThugsBefore: result.defenderThugsBefore,
    idempotentReplay: false,
  };
}
