import type { ReportCategory } from '@prisma/client';
import { cache } from 'react';
import { prisma } from '@core/lib/db/prisma';
import { getPlayerSeasonStartsAt, isReportFromCurrentRound } from '@core/server/services/round-rollover.service';
import type { ScoutResultData } from '@core/server/actions/scout.actions';
import type { PlayerIntelSnapshot } from '@core/lib/game-engine/combat/eligibility';
import type { DeepIntelSnapshot } from '@core/lib/game-engine/combat/deep-intel';
import { formatCountEstimateRange } from '@core/lib/game-engine/combat/deep-intel';
import type { AttackType } from '@core/config/game/attack-rules';
import { ATTACK_TYPE_LABELS } from '@core/config/game/attack-rules';
import {
  thugBand,
  weaponStrengthBand,
  exposureBand,
  cartelProtectionBand,
  computeConfidencePercent,
} from '@core/lib/game-engine/combat/intel-bands';
import { ATTACK_RULES } from '@core/config/game/attack-rules';
import { OS_TERMS, enforcersLabel, specialistsLabel } from '@local/config/terminology';

/** Reports shown in the player inbox — excludes routine district scout clutter. */
export function isPlayerInboxReport(metadata: unknown, category: string): boolean {
  const m = metadata as { type?: string } | null;
  if (m?.type === 'DISTRICT_SCOUT') return false;
  if (category === 'COMBAT') return true;
  if (category === 'SCOUT' && m?.type === 'PLAYER_INTEL') return true;
  if (category === 'SCOUT' && m?.type === 'DEEP_INTEL') return true;
  if (category === 'SYSTEM') return true;
  return false;
}

/** Prisma where clause for player inbox rows — applied before pagination. */
export function inboxReportWhere(
  playerId: string,
  options?: { unreadOnly?: boolean },
): {
  playerId: string;
  read?: false;
  OR: Array<
    | { category: 'COMBAT' }
    | { category: 'SYSTEM' }
    | { category: 'SCOUT'; metadata: { path: string[]; equals: string } }
  >;
} {
  return {
    playerId,
    ...(options?.unreadOnly ? { read: false as const } : {}),
    OR: [
      { category: 'COMBAT' },
      { category: 'SYSTEM' },
      { category: 'SCOUT', metadata: { path: ['type'], equals: 'PLAYER_INTEL' } },
      { category: 'SCOUT', metadata: { path: ['type'], equals: 'DEEP_INTEL' } },
    ],
  };
}

function mapReportRow(r: {
  id: string;
  category: string;
  title: string;
  summary: string;
  read: boolean;
  createdAt: Date;
  metadata: unknown;
}): ReportListItem {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    summary: r.summary,
    read: r.read,
    createdAt: r.createdAt,
    subject: extractSubject(r.metadata),
  };
}

export type ReportType = ReportCategory;

export interface PlayerIntelReportSnapshot {
  intel: PlayerIntelSnapshot;
  bands: {
    thugs: string;
    weapons: string;
    cash: string;
    drugs: string;
    cartel: string;
    confidence: number;
  };
  scoutedAt: string;
  expiresAt: string;
}

export interface DeepIntelReportSnapshot {
  deepIntel: DeepIntelSnapshot;
  scoutedAt: string;
  expiresAt: string;
}

export interface CombatReportSnapshot {
  encounterId: string;
  attackType: AttackType;
  targetAlias?: string;
  attackerAlias?: string;
  attackingThugs: number;
  ridesUsed: number;
  weaponCoverage: string;
  attackerLosses: number;
  defenderLosses: number;
  attackerReturned: number;
  attackerWeaponLosses?: { glocks: number; uzis: number; aks: number };
  defenderWeaponLosses?: { glocks: number; uzis: number; aks: number };
  defenderThugsBefore: number;
  cashStolen: number;
  workersStolen: number;
  drugsStolen: { hash: number; shrooms: number; coke: number; heroin: number };
  outcome: string;
  outcomeLabel: string;
  scoutConfidence: number;
  cartelParticipated: boolean;
  cartelResponseDeployed?: number;
  cartelResponseLosses?: number;
  cartelLocalSupport?: number;
  turnsSpent: number;
  resolvedAt: string;
}

export interface ScoutReportSnapshot {
  districtName: string;
  districtSlug: string;
  turnsSpent: number;
  prostitutesFound: number;
  thugsFound: number;
  cashEarned: number;
  prostitutesLost: number;
  thugsLost: number;
  netWorthChange: number;
  newNetWorth: number;
  newTurns: number;
  newCash: number;
  summary: string;
  scoutedAt: string;
  expiresAt: string;
}

export interface ReportListItem {
  id: string;
  category: string;
  title: string;
  summary: string;
  read: boolean;
  createdAt: Date;
  subject?: string;
}

export interface ReportDetail extends ReportListItem {
  body: string | null;
  metadata: Record<string, unknown> | null;
}

async function incrementUnread(playerId: string, delta: number) {
  await prisma.playerStatusExt.upsert({
    where: { playerId },
    create: { playerId, unreadReports: Math.max(0, delta) },
    update: { unreadReports: { increment: delta } },
  });
}

export type ValidPlayerIntelReport = {
  reportId: string;
  intel: PlayerIntelSnapshot;
  bands: PlayerIntelReportSnapshot['bands'];
  createdAt: Date;
  expired: boolean;
};

export type ValidDeepIntelReport = {
  reportId: string;
  deepIntel: DeepIntelSnapshot;
  createdAt: Date;
  expired: boolean;
};

export const ReportService = {
  async create(
    playerId: string,
    category: ReportType,
    title: string,
    summary: string,
    options?: { body?: string; metadata?: Record<string, unknown> },
  ): Promise<string> {
    const report = await prisma.report.create({
      data: {
        playerId,
        category,
        title,
        summary,
        body: options?.body ?? null,
        metadata: options?.metadata ? (options.metadata as object) : undefined,
      },
    });
    if (isPlayerInboxReport(options?.metadata ?? null, category)) {
      await incrementUnread(playerId, 1);
    }
    return report.id;
  },

  async createScoutReport(
    playerId: string,
    districtName: string,
    districtSlug: string,
    result: ScoutResultData,
    idempotencyKey?: string,
  ): Promise<string> {
    const scoutedAt = new Date();
    const expiresAt = new Date(scoutedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const snapshot: ScoutReportSnapshot = {
      districtName,
      districtSlug,
      turnsSpent: result.turnsSpent,
      prostitutesFound: result.prostitutesFound,
      thugsFound: result.thugsFound,
      cashEarned: result.cashEarned,
      prostitutesLost: result.prostitutesLost,
      thugsLost: result.thugsLost,
      netWorthChange: result.netWorthChange,
      newNetWorth: result.newNetWorth,
      newTurns: result.newTurns,
      newCash: result.newCash,
      summary: result.summary,
      scoutedAt: scoutedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    return this.create(
      playerId,
      'SCOUT',
      `Scout Report — ${districtName}`,
      `+${result.prostitutesFound} ${specialistsLabel(result.prostitutesFound).toLowerCase()}, +${result.thugsFound} ${enforcersLabel(result.thugsFound).toLowerCase()}, +$${result.cashEarned.toLocaleString()}`,
      {
        body: result.summary,
        metadata: { snapshot, type: 'DISTRICT_SCOUT', idempotencyKey: idempotencyKey ?? null },
      },
    );
  },

  async createPlayerIntelReport(
    playerId: string,
    intel: PlayerIntelSnapshot,
    idempotencyKey?: string,
  ): Promise<string> {
    const bands = {
      thugs: thugBand(intel.estimatedThugs),
      weapons: weaponStrengthBand(intel.estimatedWeaponStrength, intel.estimatedThugs),
      cash: exposureBand(intel.estimatedCash),
      drugs: exposureBand(intel.estimatedDrugs * 5),
      cartel: cartelProtectionBand(intel.cartelId, ATTACK_RULES.cartelDefenceActive),
      confidence: computeConfidencePercent(new Date(intel.scoutedAt), new Date(intel.expiresAt)),
    };

    const snapshot: PlayerIntelReportSnapshot = {
      intel,
      bands,
      scoutedAt: intel.scoutedAt,
      expiresAt: intel.expiresAt,
    };

    return this.create(
      playerId,
      'SCOUT',
      `Player Intel — ${intel.targetAlias}`,
      `${bands.thugs} ${OS_TERMS.enforcers.toLowerCase()} · ${bands.weapons} · ${bands.confidence}% confidence`,
      {
        body: `Intelligence on ${intel.targetAlias} in ${intel.targetCity}. Report valid until ${new Date(intel.expiresAt).toLocaleString()}.`,
        metadata: {
          snapshot,
          type: 'PLAYER_INTEL',
          intelLevel: 'basic',
          intel,
          idempotencyKey: idempotencyKey ?? null,
        },
      },
    );
  },

  async createDeepIntelReport(
    playerId: string,
    deepIntel: DeepIntelSnapshot,
    idempotencyKey?: string,
  ): Promise<string> {
    const snapshot: DeepIntelReportSnapshot = {
      deepIntel,
      scoutedAt: deepIntel.scoutedAt,
      expiresAt: deepIntel.expiresAt,
    };

    const thugRange = formatCountEstimateRange(deepIntel.estimatedThugMin, deepIntel.estimatedThugMax);
    const workerRange = formatCountEstimateRange(
      deepIntel.estimatedWorkerMin,
      deepIntel.estimatedWorkerMax,
    );

    return this.create(
      playerId,
      'SCOUT',
      `Deep Intel — ${deepIntel.targetAlias}`,
      `${thugRange} ${OS_TERMS.enforcers.toLowerCase()} · ${workerRange} ${OS_TERMS.specialists.toLowerCase()} · ${deepIntel.weaponReadinessBand} · ${deepIntel.workforceStabilityBand}`,
      {
        body: `Deep intelligence snapshot on ${deepIntel.targetAlias} in ${deepIntel.targetCity}.`,
        metadata: {
          snapshot,
          type: 'DEEP_INTEL',
          intelLevel: 'deep',
          deepIntel,
          idempotencyKey: idempotencyKey ?? null,
        },
      },
    );
  },

  async createCombatReports(
    attackerId: string,
    defenderId: string,
    attackerAlias: string,
    defenderAlias: string,
    snapshot: CombatReportSnapshot,
  ): Promise<{ attackerReportId: string; defenderReportId: string }> {
    const label = ATTACK_TYPE_LABELS[snapshot.attackType];
    const attackerSummary =
      snapshot.attackType === 'POACH_WORKERS'
        ? snapshot.workersStolen > 0
          ? `${OS_TERMS.specialists} extracted from ${defenderAlias}: +${snapshot.workersStolen.toLocaleString()}.`
          : `Extraction attempt vs ${defenderAlias}: ${snapshot.outcome}.`
        : `${label} vs ${defenderAlias}: ${snapshot.outcome}. Lost ${snapshot.attackerLosses}, killed ${snapshot.defenderLosses}.`;
    const defenderSummary =
      snapshot.attackType === 'POACH_WORKERS'
        ? snapshot.workersStolen > 0
          ? `${OS_TERMS.specialists} extracted by ${attackerAlias}: -${snapshot.workersStolen.toLocaleString()}.`
          : `Extraction attempt from ${attackerAlias}: ${snapshot.outcome}.`
        : `${label} from ${attackerAlias}: ${snapshot.outcome}. Lost ${snapshot.defenderLosses} ${enforcersLabel(snapshot.defenderLosses).toLowerCase()}.`;

    const attackerReportId = await this.create(
      attackerId,
      'COMBAT',
      `Attack Report — ${defenderAlias}`,
      attackerSummary,
      {
        body: snapshot.outcomeLabel,
        metadata: { snapshot, type: 'ATTACK', role: 'attacker' },
      },
    );

    const defenderReportId = await this.create(
      defenderId,
      'COMBAT',
      `Defence Report — ${attackerAlias}`,
      defenderSummary,
      {
        body: snapshot.outcomeLabel,
        metadata: { snapshot, type: 'DEFENCE', role: 'defender' },
      },
    );

    return { attackerReportId, defenderReportId };
  },

  async listScoutTargetIntelReports(playerId: string): Promise<{
    basicIntelReports: ValidPlayerIntelReport[];
    deepIntelReports: ValidDeepIntelReport[];
  }> {
    const seasonStartsAt = await getPlayerSeasonStartsAt(playerId);
    const rows = await prisma.report.findMany({
      where: { playerId, category: 'SCOUT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const now = Date.now();
    const basicIntelReports: ValidPlayerIntelReport[] = [];
    const deepIntelReports: ValidDeepIntelReport[] = [];

    for (const r of rows) {
      if (seasonStartsAt && !isReportFromCurrentRound(r.createdAt, seasonStartsAt)) continue;
      const meta = r.metadata as {
        type?: string;
        intel?: PlayerIntelSnapshot;
        snapshot?: PlayerIntelReportSnapshot;
        deepIntel?: DeepIntelSnapshot;
      } | null;

      if (meta?.type === 'PLAYER_INTEL' && meta.intel) {
        const expired = new Date(meta.intel.expiresAt).getTime() <= now;
        basicIntelReports.push({
          reportId: r.id,
          intel: meta.intel,
          bands: meta.snapshot?.bands ?? {
            thugs: thugBand(meta.intel.estimatedThugs),
            weapons: weaponStrengthBand(meta.intel.estimatedWeaponStrength, meta.intel.estimatedThugs),
            cash: exposureBand(meta.intel.estimatedCash),
            drugs: exposureBand(meta.intel.estimatedDrugs),
            cartel: cartelProtectionBand(meta.intel.cartelId, ATTACK_RULES.cartelDefenceActive),
            confidence: meta.intel.confidencePercent,
          },
          createdAt: r.createdAt,
          expired,
        });
      } else if (meta?.type === 'DEEP_INTEL' && meta.deepIntel) {
        const expired = new Date(meta.deepIntel.expiresAt).getTime() <= now;
        deepIntelReports.push({
          reportId: r.id,
          deepIntel: meta.deepIntel,
          createdAt: r.createdAt,
          expired,
        });
      }
    }

    return { basicIntelReports, deepIntelReports };
  },

  async listValidPlayerIntelReports(playerId: string): Promise<ValidPlayerIntelReport[]> {
    const seasonStartsAt = await getPlayerSeasonStartsAt(playerId);
    const rows = await prisma.report.findMany({
      where: { playerId, category: 'SCOUT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const now = Date.now();
    return rows
      .map((r) => {
        if (seasonStartsAt && !isReportFromCurrentRound(r.createdAt, seasonStartsAt)) return null;
        const meta = r.metadata as { type?: string; intel?: PlayerIntelSnapshot; snapshot?: PlayerIntelReportSnapshot } | null;
        if (meta?.type !== 'PLAYER_INTEL' || !meta.intel) return null;
        const expired = new Date(meta.intel.expiresAt).getTime() <= now;
        return {
          reportId: r.id,
          intel: meta.intel,
          bands: meta.snapshot?.bands ?? {
            thugs: thugBand(meta.intel.estimatedThugs),
            weapons: weaponStrengthBand(meta.intel.estimatedWeaponStrength, meta.intel.estimatedThugs),
            cash: exposureBand(meta.intel.estimatedCash),
            drugs: exposureBand(meta.intel.estimatedDrugs),
            cartel: cartelProtectionBand(meta.intel.cartelId, ATTACK_RULES.cartelDefenceActive),
            confidence: meta.intel.confidencePercent,
          },
          createdAt: r.createdAt,
          expired,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  },

  async listValidDeepIntelReports(playerId: string): Promise<ValidDeepIntelReport[]> {
    const seasonStartsAt = await getPlayerSeasonStartsAt(playerId);
    const rows = await prisma.report.findMany({
      where: { playerId, category: 'SCOUT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const now = Date.now();
    return rows
      .map((r) => {
        if (seasonStartsAt && !isReportFromCurrentRound(r.createdAt, seasonStartsAt)) return null;
        const meta = r.metadata as { type?: string; deepIntel?: DeepIntelSnapshot } | null;
        if (meta?.type !== 'DEEP_INTEL' || !meta.deepIntel) return null;
        const expired = new Date(meta.deepIntel.expiresAt).getTime() <= now;
        return {
          reportId: r.id,
          deepIntel: meta.deepIntel,
          createdAt: r.createdAt,
          expired,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  },

  async getDeepIntelReportForTarget(playerId: string, targetPlayerId: string) {
    const reports = await this.listValidDeepIntelReports(playerId);
    return (
      reports.find((r) => r.deepIntel.targetPlayerId === targetPlayerId && !r.expired) ??
      reports.find((r) => r.deepIntel.targetPlayerId === targetPlayerId) ??
      null
    );
  },

  async getDeepIntelReportForTargetAlias(playerId: string, targetAliasNormalized: string) {
    const reports = await this.listValidDeepIntelReports(playerId);
    const normalized = targetAliasNormalized.toLowerCase();
    return (
      reports.find(
        (r) => r.deepIntel.targetAlias.toLowerCase() === normalized && !r.expired,
      ) ??
      reports.find((r) => r.deepIntel.targetAlias.toLowerCase() === normalized) ??
      null
    );
  },

  async getRecent(playerId: string, limit = 10): Promise<ReportListItem[]> {
    const rows = await prisma.report.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      category: r.category,
      title: r.title,
      summary: r.summary,
      read: r.read,
      createdAt: r.createdAt,
      subject: extractSubject(r.metadata),
    }));
  },

  async getUnreadCount(playerId: string): Promise<number> {
    const trueCount = await prisma.report.count({
      where: inboxReportWhere(playerId, { unreadOnly: true }),
    });
    const ext = await prisma.playerStatusExt.findUnique({
      where: { playerId },
      select: { unreadReports: true },
    });
    if (ext != null && ext.unreadReports !== trueCount) {
      await prisma.playerStatusExt
        .update({
          where: { playerId },
          data: { unreadReports: trueCount },
        })
        .catch(() => {});
    }
    return trueCount;
  },

  async getUnreadDefenceAlerts(playerId: string, limit = 5): Promise<
    Array<{
      reportId: string;
      attackerAlias: string;
      attackType: AttackType;
      outcome: string;
      cashStolen: number;
      workersStolen: number;
      createdAt: Date;
    }>
  > {
    const rows = await prisma.report.findMany({
      where: { playerId, read: false, category: 'COMBAT' },
      orderBy: { createdAt: 'desc' },
      take: limit * 2,
    });

    const alerts = rows
      .map((r) => {
        const meta = r.metadata as {
          type?: string;
          role?: string;
          snapshot?: CombatReportSnapshot;
        } | null;
        if (meta?.type !== 'DEFENCE' && meta?.role !== 'defender') return null;
        const snapshot = meta?.snapshot;
        if (!snapshot?.attackerAlias) return null;
        return {
          reportId: r.id,
          attackerAlias: snapshot.attackerAlias,
          attackType: snapshot.attackType,
          outcome: snapshot.outcome,
          cashStolen: snapshot.cashStolen ?? 0,
          workersStolen: snapshot.workersStolen ?? 0,
          createdAt: r.createdAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .slice(0, limit);

    return alerts;
  },

  async getUnreadSystemAttentionReports(
    playerId: string,
    limit = 5,
  ): Promise<
    Array<{
      reportId: string;
      type: 'POLICE_RAID' | 'BUSINESS_UPGRADE_COMPLETE';
      title: string;
      summary: string;
      businessId?: string;
      businessName?: string;
      toLevel?: number;
      createdAt: Date;
    }>
  > {
    const rows = await prisma.report.findMany({
      where: { playerId, read: false, category: 'SYSTEM' },
      orderBy: { createdAt: 'desc' },
      take: limit * 3,
    });

    return rows
      .map((r) => {
        const meta = r.metadata as {
          type?: string;
          businessId?: string;
          businessName?: string;
          toLevel?: number;
        } | null;
        if (meta?.type !== 'POLICE_RAID' && meta?.type !== 'BUSINESS_UPGRADE_COMPLETE') {
          return null;
        }
        return {
          reportId: r.id,
          type: meta.type as 'POLICE_RAID' | 'BUSINESS_UPGRADE_COMPLETE',
          title: r.title,
          summary: r.summary,
          businessId: meta.businessId,
          businessName: meta.businessName,
          toLevel: meta.toLevel,
          createdAt: r.createdAt,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .slice(0, limit);
  },

  async getById(reportId: string, playerId: string): Promise<ReportDetail | null> {
    const r = await prisma.report.findFirst({
      where: { id: reportId, playerId },
    });
    if (!r) return null;
    return {
      id: r.id,
      category: r.category,
      title: r.title,
      summary: r.summary,
      read: r.read,
      createdAt: r.createdAt,
      body: r.body,
      metadata: (r.metadata as Record<string, unknown> | null) ?? null,
      subject: extractSubject(r.metadata),
    };
  },

  async markRead(reportId: string, playerId: string): Promise<number | null> {
    const report = await prisma.report.findFirst({
      where: { id: reportId, playerId },
    });
    if (!report || report.read) {
      if (!report) return null;
      return this.getUnreadCount(playerId);
    }
    const countsTowardBadge = isPlayerInboxReport(report.metadata, report.category);
    await prisma.$transaction([
      prisma.report.update({ where: { id: reportId }, data: { read: true } }),
      ...(countsTowardBadge
        ? [
            prisma.playerStatusExt.updateMany({
              where: { playerId, unreadReports: { gt: 0 } },
              data: { unreadReports: { decrement: 1 } },
            }),
          ]
        : []),
    ]);
    return this.getUnreadCount(playerId);
  },

  async markAllRead(playerId: string): Promise<number> {
    const unread = await prisma.report.count({ where: { playerId, read: false } });
    if (unread === 0) return 0;
    await prisma.$transaction([
      prisma.report.updateMany({ where: { playerId, read: false }, data: { read: true } }),
      prisma.playerStatusExt.updateMany({
        where: { playerId },
        data: { unreadReports: 0 },
      }),
    ]);
    return unread;
  },

  async listFiltered(
    playerId: string,
    filter: 'all' | 'unread',
    options?: { limit?: number; offset?: number },
  ): Promise<{ items: ReportListItem[]; hasMore: boolean }> {
    const limit = options?.limit ?? 25;
    const offset = options?.offset ?? 0;
    const rows = await prisma.report.findMany({
      where: inboxReportWhere(playerId, { unreadOnly: filter === 'unread' }),
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    return {
      items: rows.slice(0, limit).map(mapReportRow),
      hasMore,
    };
  },

  async getIntelReportForTarget(playerId: string, targetAliasNormalized: string) {
    const reports = await this.listValidPlayerIntelReports(playerId);
    return (
      reports.find(
        (r) => r.intel.targetAlias.toLowerCase() === targetAliasNormalized.toLowerCase() && !r.expired,
      ) ?? null
    );
  },
};

function extractSubject(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const m = metadata as {
    snapshot?: ScoutReportSnapshot | PlayerIntelReportSnapshot | CombatReportSnapshot;
    intel?: PlayerIntelSnapshot;
    type?: string;
  };
  const snap = m.snapshot;
  if (snap && 'districtName' in snap && snap.districtName) return snap.districtName;
  if (m.intel?.targetAlias) return m.intel.targetAlias;
  if (snap && 'targetAlias' in snap && snap.targetAlias) return snap.targetAlias;
  if (snap && 'attackerAlias' in snap && snap.attackerAlias) return snap.attackerAlias;
  return undefined;
}

/** Request-scoped dedupe for unread inbox count (layout + command + reports). */
export const getUnreadReportCount = cache((playerId: string) =>
  ReportService.getUnreadCount(playerId),
);
