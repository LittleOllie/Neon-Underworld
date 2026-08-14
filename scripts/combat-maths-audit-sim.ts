/**
 * DEV-ONLY — Core PvP combat maths audit simulation.
 * Run: npx tsx scripts/combat-maths-audit-sim.ts
 * Uses live resolveCombat — no production changes.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ATTACK_RULES, type AttackType } from '../src/config/game/attack-rules';
import { REDLITE_WEAPONS } from '../src/config/game/redlite-rules';
import { COMBAT_WEAPON_ATTRITION } from '../src/config/game/combat-attrition';
import { CANONICAL_NET_WORTH_VALUATIONS } from '../src/lib/game-engine/canonical-net-worth';
import { computeCartelResponseForce } from '../src/lib/game-engine/cartel-response-force';
import { cartelDefenceThugBonus } from '../src/lib/game-engine/cartel-economics';
import { allocateWeaponsForThugs } from '../src/lib/game-engine/combat/weapon-allocation';
import { resolveCombat, deriveCombatSeed } from '../src/lib/game-engine/combat/resolve-combat';
import { resolveWeaponAttrition } from '../src/lib/game-engine/combat/weapon-attrition';
import { createCombatRng } from '../src/lib/game-engine/combat/combat-random';
import { ridesRequiredForThugs } from '../src/lib/game-engine/combat-rules';
import { isWithinAttackRange } from '../src/config/game/redlite-rules';

const OUT_DIR = path.join(__dirname, 'output');
const MONTE_CARLO = 2000;
const ANOMALY_RUNS = 5000;

type Outcome = 'SUCCESS' | 'PARTIAL' | 'REPULSED';

interface Participant {
  thugs: number;
  glocks: number;
  uzis: number;
  aks: number;
  cash: number;
  drugs: { hash: number; shrooms: number; coke: number; heroin: number };
}

interface CartelCtx {
  responseForce: number;
  virtualSupport: number;
  glocks: number;
  uzis: number;
}

interface SimAgg {
  runs: number;
  successRate: number;
  partialRate: number;
  repulseRate: number;
  attackerVictoryRate: number;
  avgAttackerLosses: number;
  avgDefenderPersonalLosses: number;
  avgCartelLosses: number;
  avgTotalDefenderLosses: number;
  avgCashStolen: number;
  avgDrugsStolen: number;
  avgWorkersStolen: number;
  p10AttackerLosses: number;
  p90AttackerLosses: number;
  p10DefenderLosses: number;
  p90DefenderLosses: number;
}

function weaponsForProfile(
  thugs: number,
  profile: 'standard' | 'unarmed' | 'glock' | 'uzi' | 'ak' | 'mixed',
): Pick<Participant, 'glocks' | 'uzis' | 'aks'> {
  if (profile === 'unarmed') return { glocks: 0, uzis: 0, aks: 0 };
  if (profile === 'glock') return { glocks: thugs, uzis: 0, aks: 0 };
  if (profile === 'uzi') return { glocks: 0, uzis: thugs, aks: 0 };
  if (profile === 'ak') return { glocks: 0, uzis: 0, aks: thugs };
  if (profile === 'mixed') {
    const armed = thugs;
    const aks = Math.floor(armed * 0.2);
    const uzis = Math.floor(armed * 0.3);
    const glocks = Math.max(0, armed - aks - uzis);
    return { glocks, uzis, aks };
  }
  const armed = Math.floor(thugs * 0.65);
  const aks = Math.floor(armed * 0.15);
  const uzis = Math.floor(armed * 0.35);
  const glocks = Math.max(0, armed - aks - uzis);
  return { glocks, uzis, aks };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));
  return sorted[idx]!;
}

function simulate(
  attackType: AttackType,
  attackingThugs: number,
  attacker: Participant,
  defender: Participant,
  cartel: CartelCtx | null,
  runs: number,
  poach?: { workers: number; happiness: number },
): SimAgg {
  const attLosses: number[] = [];
  const defLosses: number[] = [];
  const cartelLosses: number[] = [];
  const totalDefLosses: number[] = [];
  let success = 0;
  let partial = 0;
  let repulsed = 0;
  let attVictory = 0;
  let cash = 0;
  let drugs = 0;
  let workers = 0;

  for (let i = 0; i < runs; i++) {
    const seed = deriveCombatSeed('audit-att', 'audit-def', `${attackType}-${attackingThugs}-${i}`);
    const cartelSupport = cartel?.virtualSupport ?? 0;
    const cartelArmoury = cartel
      ? { thugs: cartel.responseForce, glocks: cartel.glocks, uzis: cartel.uzis }
      : { thugs: 0, glocks: 0, uzis: 0 };
    const defenderThugsForProtection =
      defender.thugs + cartelSupport + cartelArmoury.thugs;

    const combat = resolveCombat({
      attackType,
      attackingThugs,
      seed,
      cartelSupportThugs: cartelSupport,
      cartelArmoury,
      poachContext:
        attackType === 'POACH_WORKERS' && poach
          ? {
              defenderWorkers: poach.workers,
              defenderThugsForProtection,
              workerHappiness: poach.happiness,
            }
          : undefined,
      attacker,
      defender,
    });

    attLosses.push(combat.attackerLosses);
    defLosses.push(combat.defenderLosses);
    cartelLosses.push(combat.cartelThugLosses);
    totalDefLosses.push(combat.defenderLosses + combat.cartelThugLosses);
    cash += combat.cashStolen;
    drugs += combat.drugsStolen.hash + combat.drugsStolen.shrooms + combat.drugsStolen.coke + combat.drugsStolen.heroin;
    workers += combat.workersStolen;

    if (combat.outcome === 'SUCCESS') success++;
    else if (combat.outcome === 'PARTIAL') partial++;
    else repulsed++;

    const attAlloc = allocateWeaponsForThugs(attackingThugs, {
      glocks: attacker.glocks,
      uzis: attacker.uzis,
      aks: attacker.aks,
    });
    const defAlloc = allocateWeaponsForThugs(defender.thugs, {
      glocks: defender.glocks,
      uzis: defender.uzis,
      aks: defender.aks,
    });
    const cartelAlloc = allocateWeaponsForThugs(cartelArmoury.thugs, {
      glocks: cartelArmoury.glocks,
      uzis: cartelArmoury.uzis,
      aks: 0,
    });
    const cartelSupportStr = cartelSupport * ATTACK_RULES.weapons.unarmedStrength;
    const defStr = defAlloc.totalStrength + cartelAlloc.totalStrength + cartelSupportStr;
    const ratio = defStr <= 0 ? 999 : attAlloc.totalStrength / defStr;
    if (ratio >= 1) attVictory++;
  }

  attLosses.sort((a, b) => a - b);
  defLosses.sort((a, b) => a - b);

  return {
    runs,
    successRate: success / runs,
    partialRate: partial / runs,
    repulseRate: repulsed / runs,
    attackerVictoryRate: attVictory / runs,
    avgAttackerLosses: attLosses.reduce((s, v) => s + v, 0) / runs,
    avgDefenderPersonalLosses: defLosses.reduce((s, v) => s + v, 0) / runs,
    avgCartelLosses: cartelLosses.reduce((s, v) => s + v, 0) / runs,
    avgTotalDefenderLosses: totalDefLosses.reduce((s, v) => s + v, 0) / runs,
    avgCashStolen: cash / runs,
    avgDrugsStolen: drugs / runs,
    avgWorkersStolen: workers / runs,
    p10AttackerLosses: percentile(attLosses, 0.1),
    p90AttackerLosses: percentile(attLosses, 0.9),
    p10DefenderLosses: percentile(defLosses, 0.1),
    p90DefenderLosses: percentile(defLosses, 0.9),
  };
}

function makeParticipant(thugs: number, profile: Parameters<typeof weaponsForProfile>[1], extras?: Partial<Participant>): Participant {
  const w = weaponsForProfile(thugs, profile);
  return {
    thugs,
    ...w,
    cash: extras?.cash ?? 100_000,
    drugs: extras?.drugs ?? { hash: 500, shrooms: 300, coke: 200, heroin: 100 },
  };
}

function cartelV2Context(
  defenderPersonalThugs: number,
  poolThugs: number,
  rides: number,
  glocks: number,
  uzis: number,
  mateThugs: number[],
): CartelCtx {
  return {
    responseForce: computeCartelResponseForce(defenderPersonalThugs, poolThugs, rides),
    virtualSupport: cartelDefenceThugBonus(mateThugs.map((thugs) => ({ thugs }))),
    glocks,
    uzis,
  };
}

function monotonicitySweep(
  attackType: AttackType,
  attackerSizes: number[],
  defender: Participant,
  cartel: CartelCtx | null,
  runs: number,
) {
  return attackerSizes.map((attackingThugs) => {
    const att = makeParticipant(attackingThugs, 'standard', { cash: 500_000 });
    const agg = simulate(attackType, attackingThugs, att, defender, cartel, runs);
    return { attackingThugs, ...agg };
  });
}

function reverseMonotonicitySweep(
  attackType: AttackType,
  attackingThugs: number,
  defenderSizes: number[],
  cartelFactory: (defThugs: number) => CartelCtx | null,
  runs: number,
) {
  return defenderSizes.map((defThugs) => {
    const def = makeParticipant(defThugs, 'standard');
    const agg = simulate(attackType, attackingThugs, makeParticipant(attackingThugs, 'standard'), def, cartelFactory(defThugs), runs);
    return { defenderThugs: defThugs, ...agg };
  });
}

function forceRatioMatrix(ratios: number[], scales: number[], runs: number) {
  return scales.flatMap((base) =>
    ratios.map((ratio) => {
      const attackerThugs = Math.max(1, Math.round(base * Math.sqrt(ratio)));
      const defenderThugs = Math.max(1, Math.round(base / Math.sqrt(ratio)));
      const agg = simulate(
        'HOME_INVASION',
        attackerThugs,
        makeParticipant(attackerThugs, 'standard'),
        makeParticipant(defenderThugs, 'standard'),
        null,
        runs,
      );
      const attStr = allocateWeaponsForThugs(attackerThugs, weaponsForProfile(attackerThugs, 'standard')).totalStrength;
      const defStr = allocateWeaponsForThugs(defenderThugs, weaponsForProfile(defenderThugs, 'standard')).totalStrength;
      return {
        scale: base,
        targetRatio: ratio,
        attackerThugs,
        defenderThugs,
        actualStrengthRatio: attStr / defStr,
        ...agg,
      };
    }),
  );
}

function weaponProfileSweep(thugs: number, runs: number) {
  const profiles = ['unarmed', 'glock25', 'glock50', 'glock100', 'mixed', 'uzi', 'ak'] as const;
  return profiles.map((p) => {
    let profile: Parameters<typeof weaponsForProfile>[1] = 'standard';
    let att: Participant;
    if (p === 'glock25') {
      att = { thugs, glocks: Math.floor(thugs * 0.25), uzis: 0, aks: 0, cash: 0, drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } };
    } else if (p === 'glock50') {
      att = { thugs, glocks: Math.floor(thugs * 0.5), uzis: 0, aks: 0, cash: 0, drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } };
    } else if (p === 'glock100') {
      att = makeParticipant(thugs, 'glock');
    } else if (p === 'unarmed') {
      att = makeParticipant(thugs, 'unarmed');
    } else if (p === 'uzi') {
      att = makeParticipant(thugs, 'uzi');
    } else if (p === 'ak') {
      att = makeParticipant(thugs, 'ak');
    } else {
      att = makeParticipant(thugs, 'mixed');
    }
    const def = makeParticipant(thugs, 'standard');
    const agg = simulate('HOME_INVASION', thugs, att, def, null, runs);
    const strength = allocateWeaponsForThugs(thugs, { glocks: att.glocks, uzis: att.uzis, aks: att.aks }).totalStrength;
    return { profile: p, thugs, strength, ...agg };
  });
}

function weaponAttritionSeries(battles: number, runs: number) {
  const start = { thugs: 1000, glocks: 500, uzis: 300, aks: 200 };
  const results = [];
  for (let b = 1; b <= battles; b++) {
    let thugs = start.thugs;
    let glocks = start.glocks;
    let uzis = start.uzis;
    let aks = start.aks;
    for (let r = 0; r < runs; r++) {
      for (let i = 0; i < b; i++) {
        const seed = deriveCombatSeed('att', 'def', `attrition-${b}-${r}-${i}`);
        const send = Math.min(800, thugs);
        const combat = resolveCombat({
          attackType: 'HOME_INVASION',
          attackingThugs: send,
          seed,
          attacker: { thugs, glocks, uzis, aks, cash: 0, drugs: { hash: 0, shrooms: 0, coke: 0, heroin: 0 } },
          defender: makeParticipant(600, 'standard'),
        });
        thugs = Math.max(0, thugs - combat.attackerLosses);
        glocks = Math.max(0, glocks - combat.attackerWeaponLosses.glocks);
        uzis = Math.max(0, uzis - combat.attackerWeaponLosses.uzis);
        aks = Math.max(0, aks - combat.attackerWeaponLosses.aks);
      }
    }
    results.push({
      battles,
      avgRemaining: {
        thugs: thugs / runs,
        glocks: glocks / runs,
        uzis: uzis / runs,
        aks: aks / runs,
      },
    });
  }
  return results;
}

function findMonotonicityViolations(
  rows: Array<{ attackingThugs?: number; defenderThugs?: number; successRate: number; repulseRate: number }>,
  key: 'attackingThugs' | 'defenderThugs',
  metric: 'successRate' | 'repulseRate',
  minDelta = 0.02,
) {
  const violations = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]!;
    const cur = rows[i]!;
    const prevVal = prev[metric];
    const curVal = cur[metric];
    const worse =
      metric === 'successRate' ? curVal + minDelta < prevVal : curVal > prevVal + minDelta;
    if (worse) {
      violations.push({
        from: prev[key],
        to: cur[key],
        prevMetric: prevVal,
        curMetric: curVal,
        delta: curVal - prevVal,
      });
    }
  }
  return violations;
}

function driveByAnomalyDeep(attackerSizes: number[], runs: number) {
  const defender = makeParticipant(50, 'standard');
  const cartel = cartelV2Context(50, 200, 40, 80, 40, [800, 600, 500, 400]);
  return attackerSizes.map((attackingThugs) => {
    let attWins = 0;
    let repulsed = 0;
    let attLossSum = 0;
    let defLossSum = 0;
    let attVictory = 0;
    let defGtAtt = 0;
    for (let i = 0; i < runs; i++) {
      const seed = deriveCombatSeed('anomaly', 'def', `${attackingThugs}-${i}`);
      const att = makeParticipant(attackingThugs, 'standard');
      const combat = resolveCombat({
        attackType: 'DRIVE_BY',
        attackingThugs,
        seed,
        cartelSupportThugs: cartel.virtualSupport,
        cartelArmoury: { thugs: cartel.responseForce, glocks: cartel.glocks, uzis: cartel.uzis },
        attacker: att,
        defender,
      });
      if (combat.outcome === 'SUCCESS' || combat.outcome === 'PARTIAL') attWins++;
      if (combat.outcome === 'REPULSED') repulsed++;
      attLossSum += combat.attackerLosses;
      defLossSum += combat.defenderLosses + combat.cartelThugLosses;
      const snap = combat.defenderForceSnapshot as { cartelThugLosses?: number };
      void snap;
      if (combat.defenderLosses + combat.cartelThugLosses > combat.attackerLosses) defGtAtt++;
      const attStr = allocateWeaponsForThugs(attackingThugs, { glocks: att.glocks, uzis: att.uzis, aks: att.aks }).totalStrength;
      const defStr =
        allocateWeaponsForThugs(defender.thugs, { glocks: defender.glocks, uzis: defender.uzis, aks: defender.aks }).totalStrength +
        allocateWeaponsForThugs(cartel.responseForce, { glocks: cartel.glocks, uzis: cartel.uzis, aks: 0 }).totalStrength +
        cartel.virtualSupport;
      if (attStr / defStr >= 1) attVictory++;
    }
    return {
      attackingThugs,
      runs,
      attackerSuccessRate: attWins / runs,
      repulseRate: repulsed / runs,
      attackerVictoryRate: attVictory / runs,
      defenderCasualtiesExceedAttackerRate: defGtAtt / runs,
      avgAttackerLosses: attLossSum / runs,
      avgTotalDefenderLosses: defLossSum / runs,
      cartelResponseForce: cartel.responseForce,
    };
  });
}

function boundaryCases() {
  const cases: Array<{ label: string; ok: boolean; detail: string }> = [];
  const tryCase = (label: string, fn: () => void) => {
    try {
      fn();
      cases.push({ label, ok: true, detail: 'no throw' });
    } catch (e) {
      cases.push({ label, ok: false, detail: String(e) });
    }
  };

  tryCase('0 attacker thugs', () =>
    resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 0,
      seed: 1,
      attacker: makeParticipant(0, 'unarmed'),
      defender: makeParticipant(10, 'standard'),
    }),
  );
  tryCase('1v1 unarmed', () =>
    resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 1,
      seed: 2,
      attacker: makeParticipant(1, 'unarmed'),
      defender: makeParticipant(1, 'unarmed'),
    }),
  );
  tryCase('defender 0 thugs cartel only', () =>
    resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 50,
      seed: 3,
      cartelArmoury: { thugs: 100, glocks: 50, uzis: 20 },
      attacker: makeParticipant(50, 'standard'),
      defender: makeParticipant(0, 'unarmed'),
    }),
  );
  tryCase('virtual support only', () =>
    resolveCombat({
      attackType: 'DRIVE_BY',
      attackingThugs: 50,
      seed: 4,
      cartelSupportThugs: 200,
      attacker: makeParticipant(50, 'standard'),
      defender: makeParticipant(20, 'standard'),
    }),
  );
  tryCase('large scale 50k vs 50k', () =>
    resolveCombat({
      attackType: 'HOME_INVASION',
      attackingThugs: 5000,
      seed: 5,
      attacker: makeParticipant(50000, 'standard'),
      defender: makeParticipant(50000, 'standard'),
    }),
  );

  return cases;
}

function economicEstimate(thugsLost: number, weaponLosses: { glocks: number; uzis: number; aks: number }, cashStolen: number, cartelThugsLost: number) {
  const thugCost = thugsLost * CANONICAL_NET_WORTH_VALUATIONS.thug;
  const weaponCost =
    weaponLosses.glocks * 500 +
    weaponLosses.uzis * 1500 +
    weaponLosses.aks * (REDLITE_WEAPONS.ak.shopPrice ?? 5000);
  const cartelCost = cartelThugsLost * 700;
  return { thugCost, weaponCost, cartelCost, cashStolen, net: cashStolen - thugCost - weaponCost - cartelCost };
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const attackerSizes = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
  const defenderSizes = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  const fixedDefender = makeParticipant(100, 'standard', { cash: 200_000, drugs: { hash: 1000, shrooms: 800, coke: 600, heroin: 400 } });
  const fixedDefenderSmall = makeParticipant(50, 'standard');
  const cartelSmall = cartelV2Context(50, 200, 40, 80, 40, [800, 600, 500, 400]);

  const monotonicityByType = Object.fromEntries(
    (['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS', 'POACH_WORKERS'] as AttackType[]).map((type) => [
      type,
      monotonicitySweep(type, attackerSizes, fixedDefender, null, MONTE_CARLO),
    ]),
  );

  const monotonicityWithCartel = monotonicitySweep('DRIVE_BY', attackerSizes, fixedDefenderSmall, cartelSmall, MONTE_CARLO);

  const reverseMono = reverseMonotonicitySweep(
    'HOME_INVASION',
    500,
    defenderSizes,
    () => null,
    MONTE_CARLO,
  );

  const forceMatrix = forceRatioMatrix(
    [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5, 10],
    [50, 500, 5000],
    800,
  );

  const absoluteScale = [100, 1000, 10000].map((n) => {
    const agg = simulate('HOME_INVASION', n, makeParticipant(n, 'mixed'), makeParticipant(n, 'mixed'), null, MONTE_CARLO);
    return { thugsPerSide: n, ...agg };
  });

  const weaponAudit100 = weaponProfileSweep(100, MONTE_CARLO);
  const weaponAudit1000 = weaponProfileSweep(1000, 800);

  const attrition = weaponAttritionSeries(25, 100);

  const attackTypeCompare = (['DRIVE_BY', 'HOME_INVASION', 'RAID_DRUG_LABS', 'POACH_WORKERS'] as AttackType[]).map((type) => {
    const agg = simulate(
      type,
      500,
      makeParticipant(500, 'standard', { cash: 300_000 }),
      makeParticipant(300, 'standard', { cash: 150_000, drugs: { hash: 2000, shrooms: 1500, coke: 1000, heroin: 800 } }),
      cartelV2Context(300, 5000, 200, 500, 300, [400, 350, 300]),
      MONTE_CARLO,
      type === 'POACH_WORKERS' ? { workers: 200, happiness: 45 } : undefined,
    );
    return { attackType: type, turnCost: ATTACK_RULES.turnCosts[type], ...agg };
  });

  const anomalySizes = [500, 1000, 2500, 5000, 10000];
  const anomaly = driveByAnomalyDeep(anomalySizes, ANOMALY_RUNS);
  const anomalyFull = driveByAnomalyDeep(attackerSizes.filter((n) => n >= 100 && n <= 10000), 2000);

  const drugRaidTiny = simulate('RAID_DRUG_LABS', 300, makeParticipant(300, 'standard'), makeParticipant(200, 'standard', { drugs: { hash: 5, shrooms: 0, coke: 0, heroin: 0 } }), null, MONTE_CARLO);
  const drugRaidHuge = simulate('RAID_DRUG_LABS', 300, makeParticipant(300, 'standard'), makeParticipant(200, 'standard', { drugs: { hash: 50000, shrooms: 40000, coke: 30000, heroin: 20000 } }), null, MONTE_CARLO);

  const poachCases = [
    { label: 'many workers few thugs', workers: 500, defThugs: 50, happiness: 35 },
    { label: 'few workers many thugs', workers: 80, defThugs: 400, happiness: 45 },
    { label: 'cartel protected', workers: 200, defThugs: 100, happiness: 45, cartel: cartelV2Context(100, 5000, 200, 500, 300, [400, 350]) },
    { label: 'zero workers', workers: 0, defThugs: 100, happiness: 50 },
    { label: 'zero defender thugs', workers: 150, defThugs: 0, happiness: 40 },
  ].map((c) => {
    const def = makeParticipant(c.defThugs, 'standard');
    const cartel = c.cartel ?? null;
    const agg = simulate('POACH_WORKERS', 400, makeParticipant(400, 'standard'), def, cartel, MONTE_CARLO, { workers: c.workers, happiness: c.happiness });
    return { ...c, ...agg };
  });

  const rngSpread = Array.from({ length: MONTE_CARLO }, (_, i) => {
    const c = resolveCombat({
      attackType: 'HOME_INVASION',
      attackingThugs: 200,
      seed: i,
      attacker: makeParticipant(200, 'standard'),
      defender: makeParticipant(200, 'standard'),
    });
    return c.attackerLosses;
  }).sort((a, b) => a - b);

  const econSample = simulate('HOME_INVASION', 500, makeParticipant(500, 'standard'), makeParticipant(300, 'standard', { cash: 250_000 }), null, MONTE_CARLO);
  const econ = economicEstimate(
    econSample.avgAttackerLosses,
    { glocks: 3, uzis: 2, aks: 1 },
    econSample.avgCashStolen,
    0,
  );

  const driveByViolations = findMonotonicityViolations(monotonicityByType.DRIVE_BY!, 'attackingThugs', 'successRate');
  const driveByRepulseViolations = findMonotonicityViolations(monotonicityByType.DRIVE_BY!, 'attackingThugs', 'repulseRate');
  const homeViolations = findMonotonicityViolations(monotonicityByType.HOME_INVASION!, 'attackingThugs', 'successRate');

  const report = {
    generatedAt: new Date().toISOString(),
    engine: {
      weaponStrengths: {
        glock: ATTACK_RULES.weapons.glock.strength,
        uzi: ATTACK_RULES.weapons.uzi.strength,
        ak: ATTACK_RULES.weapons.ak.strength,
        unarmed: ATTACK_RULES.weapons.unarmedStrength,
      },
      forceVariance: { min: ATTACK_RULES.randomVarianceMin, max: ATTACK_RULES.randomVarianceMax },
      rides: { thugsPerRide: ATTACK_RULES.thugsPerRide, formula: 'ceil(attackingThugs / 5)' },
      weaponAttrition: COMBAT_WEAPON_ATTRITION,
      attackRange: { minTargetNwRatio: 0.5, noUpperCap: true },
      driveByOutcomeRule: 'SUCCESS/PARTIAL iff defenderLosses > attackerLosses (NOT force ratio)',
      otherOutcomeRule: 'Uses attackerVictory (ratio>=1) + theft/poach gates',
    },
    monotonicity: {
      byAttackType: monotonicityByType,
      driveByWithCartelV2: monotonicityWithCartel,
      violations: {
        driveBySuccess: driveByViolations,
        driveByRepulseIncreases: driveByRepulseViolations,
        homeInvasionSuccess: homeViolations,
      },
    },
    reverseMonotonicity: reverseMono,
    forceRatioMatrix: forceMatrix,
    absoluteScale,
    weaponAudit: { at100: weaponAudit100, at1000: weaponAudit1000 },
    weaponAttrition: attrition,
    attackTypeComparison: attackTypeCompare,
    driveByAnomaly: { deep: anomaly, sweep: anomalyFull },
    drugRaid: { tinyInventory: drugRaidTiny, hugeInventory: drugRaidHuge },
    poachCases,
    rng: {
      homeInvasion200v200: {
        p10: percentile(rngSpread, 0.1),
        median: percentile(rngSpread, 0.5),
        p90: percentile(rngSpread, 0.9),
        min: rngSpread[0],
        max: rngSpread[rngSpread.length - 1],
      },
    },
    boundaryCases: boundaryCases(),
    economics: {
      sampleHomeInvasion500v300: { combat: econSample, estimate: econ },
      thugNw: CANONICAL_NET_WORTH_VALUATIONS.thug,
      dailyAttacksModel: [1, 5, 10, 20].map((n) => ({
        attacksPerDay: n,
        estAttackerThugLossPerDay: econSample.avgAttackerLosses * n,
        estAttackerThugNwLossPerDay: econSample.avgAttackerLosses * n * CANONICAL_NET_WORTH_VALUATIONS.thug,
        turnCostPerAttack: ATTACK_RULES.turnCosts.HOME_INVASION,
        turnsPerDay: n * ATTACK_RULES.turnCosts.HOME_INVASION,
      })),
    },
    ridesAudit: {
      formula: ridesRequiredForThugs(100, 5),
      examples: [1, 5, 6, 25, 100, 5000].map((t) => ({ attackingThugs: t, ridesRequired: ridesRequiredForThugs(t, 5) })),
      ridesNotConsumed: true,
      defenderRidesIrrelevant: true,
    },
    cartelV2: {
      exampleResponseForce: cartelSmall,
      monotonicityWithCartel: findMonotonicityViolations(monotonicityWithCartel, 'attackingThugs', 'successRate'),
    },
  };

  const outPath = path.join(OUT_DIR, 'combat-maths-audit.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log('Drive-By success violations:', driveByViolations.length);
  console.log('Drive-By repulse increases:', driveByRepulseViolations.length);
  console.log('Anomaly deep:', JSON.stringify(anomaly, null, 2));
}

main();
