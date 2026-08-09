import type { ReportCategory } from '@prisma/client';
import { prisma } from '@core/lib/db/prisma';
import type { ScoutResultData } from '@core/server/actions/scout.actions';
import type { PlayerIntelSnapshot } from '@core/lib/game-engine/combat/eligibility';
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

/** Reports shown in the player inbox — excludes routine district scout clutter. */
export function isPlayerInboxReport(metadata: unknown, category: string): boolean {
  const m = metadata as { type?: string } | null;
  if (m?.type === 'DISTRICT_SCOUT') return false;
  if (category === 'COMBAT') return true;
  if (category === 'SCOUT' && m?.type === 'PLAYER_INTEL') return true;
  if (category === 'SYSTEM') return true;
  return false;
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
  defenderThugsBefore: number;
  cashStolen: number;
  drugsStolen: { hash: number; shrooms: number; coke: number; heroin: number };
  outcome: string;
  outcomeLabel: string;
  scoutConfidence: number;
  cartelParticipated: boolean;
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
    await incrementUnread(playerId, 1);
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
      `+${result.prostitutesFound} workers, +${result.thugsFound} thugs, +$${result.cashEarned.toLocaleString()}`,
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
      `${bands.thugs} thugs · ${bands.weapons} · ${bands.confidence}% confidence`,
      {
        body: `Intelligence on ${intel.targetAlias} in ${intel.targetCity}. Report valid until ${new Date(intel.expiresAt).toLocaleString()}.`,
        metadata: { snapshot, type: 'PLAYER_INTEL', intel, idempotencyKey: idempotencyKey ?? null },
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
    const attackerSummary = `${label} vs ${defenderAlias}: ${snapshot.outcome}. Lost ${snapshot.attackerLosses}, killed ${snapshot.defenderLosses}.`;
    const defenderSummary = `${label} from ${attackerAlias}: ${snapshot.outcome}. Lost ${snapshot.defenderLosses} thugs.`;

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

  async listValidPlayerIntelReports(playerId: string): Promise<
    Array<{
      reportId: string;
      intel: PlayerIntelSnapshot;
      bands: PlayerIntelReportSnapshot['bands'];
      createdAt: Date;
      expired: boolean;
    }>
  > {
    const rows = await prisma.report.findMany({
      where: { playerId, category: 'SCOUT' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const now = Date.now();
    return rows
      .map((r) => {
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
    const rows = await prisma.report.findMany({
      where: { playerId, read: false },
      select: { category: true, metadata: true },
    });
    return rows.filter((r) => isPlayerInboxReport(r.metadata, r.category)).length;
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

  async markRead(reportId: string, playerId: string): Promise<boolean> {
    const report = await prisma.report.findFirst({
      where: { id: reportId, playerId },
    });
    if (!report || report.read) return !!report;
    await prisma.$transaction([
      prisma.report.update({ where: { id: reportId }, data: { read: true } }),
      prisma.playerStatusExt.updateMany({
        where: { playerId, unreadReports: { gt: 0 } },
        data: { unreadReports: { decrement: 1 } },
      }),
    ]);
    return true;
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
  ): Promise<ReportListItem[]> {
    const rows = await prisma.report.findMany({
      where: {
        playerId,
        ...(filter === 'unread' ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows
      .filter((r) => isPlayerInboxReport(r.metadata, r.category))
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        category: r.category,
        title: r.title,
        summary: r.summary,
        read: r.read,
        createdAt: r.createdAt,
        subject: extractSubject(r.metadata),
      }));
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
