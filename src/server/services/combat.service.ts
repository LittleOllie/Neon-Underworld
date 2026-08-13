import { prisma } from '@/lib/db/prisma';
import { runSerializableTransaction, COMBAT_TRANSACTION_OPTIONS } from '@/lib/db/serializable-transaction';
import { CartelService } from '@/server/services/cartel.service';
import { OfflineProtectionService } from '@/server/services/offline-protection.service';
import { ATTACK_RULES, type AttackType } from '@/config/game/attack-rules';
import {
  validateAttackEligibilityCode,
  ridesRequired,
  type PlayerIntelSnapshot,
} from '@/lib/game-engine/combat/eligibility';
import {
  calculatePlayerCanonicalNetWorthWithBusinesses,
  loadBusinessNwRowsInTx,
} from '@/lib/game-engine/business/net-worth';
import { allocateWeaponsForThugs, weaponCoverageBand } from '@/lib/game-engine/combat/weapon-allocation';
import { deriveCombatSeed, resolveCombat } from '@/lib/game-engine/combat/resolve-combat';
import { calculateProstituteHappiness } from '@/lib/game-engine/happiness';
import {
  consumeTurns,
  resolveCanonicalTurnState,
  settleTurnRegeneration,
} from '@/lib/game-engine/turns';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import { SeasonInactiveError } from '@/lib/game-engine/errors';
import { GameplayError } from '@/lib/game-engine/gameplay-errors';
import { assertPlayerCanPerformAction } from '@/lib/game-engine/player-action-guard';

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
  attackerWeaponLosses: { glocks: number; uzis: number; aks: number };
  defenderWeaponLosses: { glocks: number; uzis: number; aks: number };
  attackerReturned: number;
  cashStolen: number;
  workersStolen: number;
  drugsStolen: { hash: number; shrooms: number; coke: number; heroin: number };
  turnsSpent: number;
  ridesUsed: number;
  weaponCoverage: string;
  forceEstimate: string;
  targetAlias: string;
  targetAliasNormalized: string;
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

/** @deprecated Combat resolves business-aware NW internally — do not inject blind calculators. */
export type LegacyNetWorthCalculator = NetWorthCalculator;

/** Stored on CombatEncounter when attacking without prior player intel */
export const DIRECT_ATTACK_SCOUT_REPORT_ID = 'direct-attack';

function safeSnapshot(value: Record<string, unknown>): object {
  return JSON.parse(JSON.stringify(value)) as object;
}

function safeInt(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(value));
}

export type AttackEncounterTarget =
  | { kind: 'intel'; scoutReportId: string }
  | { kind: 'direct'; defenderAliasNormalized: string };

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
  target: AttackEncounterTarget,
  attackType: AttackType,
  attackingThugs: number,
  idempotencyKey: string,
): Promise<CombatResolutionOutput> {
  const thugs = Math.floor(Number(attackingThugs));
  if (!Number.isFinite(thugs) || thugs < ATTACK_RULES.minAttackingThugs) {
    throw new GameplayError('INVALID_FORCE', 'Enter a valid number of thugs.');
  }
  const turnCost = ATTACK_RULES.turnCosts[attackType];
  if (!Number.isInteger(turnCost) || turnCost < 1) {
    throw new GameplayError('INVALID_FORCE', 'Invalid attack type.');
  }
  attackingThugs = thugs;

  const scoutReportId =
    target.kind === 'intel' ? target.scoutReportId : DIRECT_ATTACK_SCOUT_REPORT_ID;

  const existing = await prisma.combatEncounter.findUnique({
    where: { attackerId_idempotencyKey: { attackerId, idempotencyKey } },
    include: { defender: { select: { alias: true, aliasNormalized: true, id: true } } },
  });

  if (existing) {
    const intelReport =
      target.kind === 'intel'
        ? await prisma.report.findFirst({ where: { id: target.scoutReportId, playerId: attackerId } })
        : null;
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
      attackerWeaponLosses: { glocks: 0, uzis: 0, aks: 0 },
      defenderWeaponLosses: { glocks: 0, uzis: 0, aks: 0 },
      attackerReturned: existing.attackerReturned,
      cashStolen: existing.cashStolen,
      workersStolen: existing.workersStolen ?? 0,
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
      targetAliasNormalized: existing.defender.aliasNormalized,
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

  const result = await runSerializableTransaction(async (tx) => {
    const attacker = await tx.player.findUniqueOrThrow({
      where: { id: attackerId },
      include: { turnState: true, district: true, season: true },
    });
    if (!attacker.turnState) throw new GameplayError('TARGET_UNAVAILABLE', 'Your account is not ready for combat. Refresh and try again.');
    if (attacker.season.status !== 'ACTIVE') throw new SeasonInactiveError();
    assertPlayerCanPerformAction(attacker);

    let intel: PlayerIntelSnapshot | null = null;
    let defender;

    if (target.kind === 'intel') {
      const report = await tx.report.findFirst({
        where: { id: target.scoutReportId, playerId: attackerId },
      });
      if (!report) throw new GameplayError('INVALID_INTEL');
      intel = parseIntelFromReport(report.metadata);
      if (!intel) throw new GameplayError('INVALID_INTEL');

      defender = await tx.player.findUniqueOrThrow({
        where: { id: intel.targetPlayerId },
        include: { district: true, season: true, turnState: true },
      });
    } else {
      defender = await tx.player.findFirst({
        where: {
          aliasNormalized: target.defenderAliasNormalized,
          seasonId: attacker.seasonId,
          isSystemPlayer: false,
        },
        include: { district: true, season: true, turnState: true },
      });
      if (!defender) throw new GameplayError('INVALID_TARGET');
    }

    const attackerRecord = attacker as unknown as CombatPlayerRecord;
    const defenderRecord = defender as unknown as CombatPlayerRecord;

    const businessRowsByPlayer = await loadBusinessNwRowsInTx(tx, [attacker.id, defender.id]);
    const attackerNw = calculatePlayerCanonicalNetWorthWithBusinesses(
      attackerRecord,
      businessRowsByPlayer.get(attacker.id) ?? [],
    );
    const defenderNw = calculatePlayerCanonicalNetWorthWithBusinesses(
      defenderRecord,
      businessRowsByPlayer.get(defender.id) ?? [],
    );

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

    const defenderOfflineState = await OfflineProtectionService.getStateInTx(tx, defender.id);
    const defenderOfflineProtected = OfflineProtectionService.isDefenderProtected(defenderOfflineState);

    const eligibilityCode = validateAttackEligibilityCode({
      attackerId,
      defenderId: defender.id,
      attackerDistrictId: attacker.districtId,
      defenderDistrictId: defender.districtId,
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
      defenderWorkers: defender.prostitutes,
      defenderOfflineProtected,
      allowDirectAttack: target.kind === 'direct',
    });
    if (eligibilityCode) {
      const message =
        eligibilityCode === 'TARGET_WRONG_DISTRICT' && intel && target.kind !== 'direct'
          ? 'This player is no longer in your city.'
          : undefined;
      throw new GameplayError(eligibilityCode, message);
    }

    const turnCost = ATTACK_RULES.turnCosts[attackType];
    if (!Number.isInteger(turnCost) || turnCost < 1) {
      throw new GameplayError('INVALID_FORCE', 'Invalid attack type.');
    }
    const { newState: turnStateAfter } = consumeTurns(settled, turnCost);

    const defenderThugsBefore = defender.thugs;
    let cartelSupportThugs = 0;
    let cartelArmoury = { thugs: 0, glocks: 0, uzis: 0 };
    if (ATTACK_RULES.cartelDefenceActive && defender.cartelId && !defender.travelling) {
      const cartelDefence = await CartelService.getCartelDefenceContextInTx(tx, defender.id);
      cartelSupportThugs = cartelDefence.virtualSupportThugs;
      cartelArmoury = {
        thugs: cartelDefence.ownedThugs,
        glocks: cartelDefence.ownedGlocks,
        uzis: cartelDefence.ownedUzis,
      };
    }
    const seed = deriveCombatSeed(attackerId, defender.id, idempotencyKey);

    const defenderThugsForProtection =
      defender.thugs + cartelSupportThugs + cartelArmoury.thugs;
    const workerHappiness = calculateProstituteHappiness({
      prostitutes: defender.prostitutes,
      thugs: defender.thugs,
      hash: defender.hash,
      condoms: defender.condoms,
      prostitutePayoutPercent: defender.prostitutePayoutPercent,
    }).score;

    const combat = resolveCombat({
      attackType,
      attackingThugs,
      seed,
      cartelSupportThugs,
      cartelArmoury,
      poachContext:
        attackType === 'POACH_WORKERS'
          ? {
              defenderWorkers: defender.prostitutes,
              defenderThugsForProtection,
              workerHappiness,
            }
          : undefined,
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
        glocks: Math.max(0, attacker.glocks - combat.attackerWeaponLosses.glocks),
        uzis: Math.max(0, attacker.uzis - combat.attackerWeaponLosses.uzis),
        aks: Math.max(0, attacker.aks - combat.attackerWeaponLosses.aks),
        cash: safeInt(attacker.cash + combat.cashStolen),
        prostitutes: safeInt(attacker.prostitutes + combat.workersStolen),
        hash: safeInt(attacker.hash + combat.drugsStolen.hash),
        shrooms: safeInt(attacker.shrooms + combat.drugsStolen.shrooms),
        coke: safeInt(attacker.coke + combat.drugsStolen.coke),
        heroin: safeInt(attacker.heroin + combat.drugsStolen.heroin),
      },
    });

    await tx.player.update({
      where: { id: defender.id },
      data: {
        thugs: Math.max(0, defender.thugs - combat.defenderLosses),
        glocks: Math.max(0, defender.glocks - combat.defenderWeaponLosses.glocks),
        uzis: Math.max(0, defender.uzis - combat.defenderWeaponLosses.uzis),
        aks: Math.max(0, defender.aks - combat.defenderWeaponLosses.aks),
        cash: Math.max(0, defender.cash - combat.cashStolen),
        prostitutes: Math.max(0, defender.prostitutes - combat.workersStolen),
        hash: Math.max(0, defender.hash - combat.drugsStolen.hash),
        shrooms: Math.max(0, defender.shrooms - combat.drugsStolen.shrooms),
        coke: Math.max(0, defender.coke - combat.drugsStolen.coke),
        heroin: Math.max(0, defender.heroin - combat.drugsStolen.heroin),
      },
    });

    if (combat.cartelThugLosses > 0 && defender.cartelId) {
      await tx.cartel.update({
        where: { id: defender.cartelId },
        data: { thugs: { decrement: combat.cartelThugLosses } },
      });
    }

    const defenderWasOffline = OfflineProtectionService.defenderWasOfflineAt(
      defenderOfflineState.lastSeenAt,
    );
    if (
      OfflineProtectionService.isDamagingAttackResult(combat) &&
      defenderWasOffline
    ) {
      await OfflineProtectionService.recordDefenderOfflineHitInTx(
        tx,
        defender.id,
        true,
        true,
      );
    }

    await OfflineProtectionService.resetProtectionCycleInTx(tx, attackerId);

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
        attackerForceSnapshot: safeSnapshot(combat.attackerForceSnapshot),
        defenderForceSnapshot: safeSnapshot(combat.defenderForceSnapshot),
        attackerLosses: combat.attackerLosses,
        defenderLosses: combat.defenderLosses,
        attackerReturned: combat.attackerReturned,
        cashStolen: combat.cashStolen,
        workersStolen: combat.workersStolen,
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
        requestPayload:
          target.kind === 'intel'
            ? ({ scoutReportId: target.scoutReportId, attackType, attackingThugs } as object)
            : ({ directTarget: target.defenderAliasNormalized, attackType, attackingThugs } as object),
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
          glocks: -combat.attackerWeaponLosses.glocks,
          uzis: -combat.attackerWeaponLosses.uzis,
          aks: -combat.attackerWeaponLosses.aks,
          cash: combat.cashStolen,
          prostitutes: combat.workersStolen,
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
  }, COMBAT_TRANSACTION_OPTIONS);

  return {
    encounterId: result.encounter.id,
    attackType,
    outcome: result.combat.outcome,
    outcomeLabel: result.combat.outcomeLabel,
    attackingThugs,
    attackerLosses: result.combat.attackerLosses,
    defenderLosses: result.combat.defenderLosses,
    attackerWeaponLosses: result.combat.attackerWeaponLosses,
    defenderWeaponLosses: result.combat.defenderWeaponLosses,
    attackerReturned: result.combat.attackerReturned,
    cashStolen: result.combat.cashStolen,
    workersStolen: result.combat.workersStolen,
    drugsStolen: result.combat.drugsStolen,
    turnsSpent: ATTACK_RULES.turnCosts[attackType],
    ridesUsed: ridesRequired(attackingThugs),
    weaponCoverage: weaponCoverageBand(result.attackerAlloc.armedThugs, attackingThugs),
    forceEstimate: result.combat.forceEstimate,
    targetAlias: result.defender.alias,
    targetAliasNormalized: result.defender.aliasNormalized,
    targetPlayerId: result.defender.id,
    scoutReportId,
    scoutConfidence: result.intel?.confidencePercent ?? 0,
    newTurns: result.turnStateAfter.currentTurns,
    attackerForceSnapshot: result.combat.attackerForceSnapshot,
    defenderForceSnapshot: result.combat.defenderForceSnapshot,
    defenderThugsBefore: result.defenderThugsBefore,
    idempotentReplay: false,
  };
}
