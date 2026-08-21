/**
 * Local development NPC fixtures — static playtest population (~40 attackable operators).
 * NOT autonomous progression; safe to reset and reseed.
 */
import type { PrismaClient } from '@prisma/client';
import { PlayerAvatarSource, SeasonStatus } from '@prisma/client';
import { hashPassword, normalizeAlias } from '../../src/lib/security/crypto';
import { TURNS_CONFIG } from '../../src/config/game/balance';
import { createInitialTurnState } from '../../src/lib/game-engine/turns';
import { calculateCanonicalNetWorthFromPlayer } from '../../src/lib/game-engine/canonical-net-worth';
import { aggregateBusinessNwContext } from '../../src/server/services/business.service';
import { createSeededRng } from '../../src/lib/game-engine/rng';
import { resolveNpcSeedAvatar } from '../../src/lib/game-engine/npc-avatar';
import { applyNpcTargetStateToPlayer } from '../../src/lib/game-engine/npc-progression/initialize';
import {
  archetypeForLadderSlot,
  type NpcArchetypeId,
} from '../../src/config/game/npc-progression-rules';
import { isLocalNpcSeedEmail } from './dev-guard';

export const LOCAL_NPC_COUNT = 40;
export const LOCAL_NPC_EMAIL_PREFIX = 'local-npc+';
export const LOCAL_NPC_ALIAS_PREFIX = 'Fix';

/** Local manual-test NW spread — lower floor than playtest ladder for fresh human accounts. */
export const LOCAL_NPC_NW_BAND = { minNw: 2_500, maxNw: 220_000 } as const;

export const LOCAL_NPC_DISTRICT_SLUGS = ['neon-strip', 'docklands', 'old-quarter'] as const;

export const LOCAL_FIXTURE_CARTEL_TAGS = ['LFX-NS', 'LFX-DK', 'LFX-OQ'] as const;

const NAME_PARTS = [
  'Neon', 'Dock', 'Grid', 'Velvet', 'Cipher', 'Ash', 'Wire', 'Pulse', 'Rust', 'Harbor',
  'Strip', 'Quarter', 'Lantern', 'Fleet', 'Mirror', 'Quiet', 'Silver', 'Brass', 'Copper', 'Obsidian',
  'Runner', 'Wolf', 'King', 'Ghost', 'Baron', 'Strike', 'Heir', 'Broker', 'Phantom', 'Regent',
  'Syndicate', 'Warden', 'Collector', 'Signal', 'Serpent', 'Saint', 'Duke', 'Consul', 'Monarch', 'Auditor',
] as const;

/** Post-apply patches for attack/eligibility edge cases (index → partial player update). */
export const LOCAL_NPC_EDGE_PATCHES: Record<
  number,
  {
    travelling?: boolean;
    bankCash?: number;
    cash?: number;
    lastSeenHoursAgo?: number;
  }
> = {
  2: { bankCash: 18_000, cash: 800 },
  6: { travelling: true },
  9: { lastSeenHoursAgo: 96 },
  38: { bankCash: 45_000 },
};

/** Cartel membership by fixture index (remainder stay independent). District must match cartel home. */
export const LOCAL_NPC_CARTEL_ASSIGNMENTS: Record<number, (typeof LOCAL_FIXTURE_CARTEL_TAGS)[number]> = {
  0: 'LFX-NS',
  3: 'LFX-NS',
  6: 'LFX-NS',
  9: 'LFX-NS',
  1: 'LFX-DK',
  4: 'LFX-DK',
  7: 'LFX-DK',
  2: 'LFX-OQ',
  5: 'LFX-OQ',
  8: 'LFX-OQ',
};

export function localNpcAlias(index: number): string {
  const a = NAME_PARTS[index % 20]!;
  const b = NAME_PARTS[20 + (index % 20)]!;
  return `${LOCAL_NPC_ALIAS_PREFIX}${a}${b}${String(index + 1).padStart(2, '0')}`;
}

export function localNpcEmail(aliasNormalized: string): string {
  return `${LOCAL_NPC_EMAIL_PREFIX}${aliasNormalized}@neonunderworld.local`;
}

export function progressionMetaForLocalSlot(index: number) {
  const ladderSlot = index;
  const growthSeed = index * 7919 + 9001;
  const archetype = archetypeForLadderSlot(ladderSlot, LOCAL_NPC_COUNT);
  return { ladderSlot, growthSeed, archetype };
}

/** Static fixtures — no round simulation. Top slots get businesses added separately. */
export function roundDayForLocalSlot(_ladderSlot: number): number {
  return 1;
}

export function isLocalNpcFixtureAlias(alias: string): boolean {
  return alias.startsWith(LOCAL_NPC_ALIAS_PREFIX);
}

async function createRankSnapshots(
  prisma: PrismaClient,
  playerId: string,
  seasonId: string,
  netWorth: number,
  seed: number,
) {
  const rng = createSeededRng(seed);
  const drift = Math.max(500, Math.round(netWorth * rng.nextFloat(0.03, 0.12)));
  await prisma.rankSnapshot.create({
    data: {
      playerId,
      seasonId,
      netWorth: Math.max(0, netWorth - drift),
      rank: 0,
      createdAt: new Date(Date.now() - rng.nextInt(2, 10) * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.rankSnapshot.create({
    data: { playerId, seasonId, netWorth, rank: 0 },
  });
}

export async function resetLocalNpcFixtures(prisma: PrismaClient): Promise<number> {
  const fixtureUsers = await prisma.user.findMany({
    where: { email: { startsWith: LOCAL_NPC_EMAIL_PREFIX } },
    select: { id: true, email: true },
  });

  if (fixtureUsers.length === 0) {
    await prisma.cartel.deleteMany({
      where: { tag: { in: [...LOCAL_FIXTURE_CARTEL_TAGS] } },
    });
    return 0;
  }

  const userIds = fixtureUsers.map((u) => u.id);
  await prisma.player.updateMany({
    where: { userId: { in: userIds } },
    data: { cartelId: null, cartelDonationPercent: 0 },
  });

  await prisma.cartel.deleteMany({
    where: { tag: { in: [...LOCAL_FIXTURE_CARTEL_TAGS] } },
  });

  await prisma.user.deleteMany({
    where: { id: { in: userIds } },
  });

  return fixtureUsers.length;
}

async function ensureLocalFixtureCartels(
  prisma: PrismaClient,
  playersByIndex: Map<number, { id: string; districtSlug: string }>,
) {
  const cartelsByTag = new Map<string, string>();

  const specs = [
    { tag: 'LFX-NS', name: 'Local Fixture — Neon Strip', districtSlug: 'neon-strip' },
    { tag: 'LFX-DK', name: 'Local Fixture — Docklands', districtSlug: 'docklands' },
    { tag: 'LFX-OQ', name: 'Local Fixture — Old Quarter', districtSlug: 'old-quarter' },
  ] as const;

  for (const spec of specs) {
    const existing = await prisma.cartel.findFirst({ where: { tag: spec.tag } });
    if (existing) {
      cartelsByTag.set(spec.tag, existing.id);
      continue;
    }

    const leaderEntry = [...playersByIndex.entries()].find(
      ([idx, p]) =>
        LOCAL_NPC_CARTEL_ASSIGNMENTS[idx] === spec.tag && p.districtSlug === spec.districtSlug,
    );
    if (!leaderEntry) continue;

    const cartel = await prisma.cartel.create({
      data: {
        name: spec.name,
        tag: spec.tag,
        leaderId: leaderEntry[1].id,
        treasuryCash: 25_000,
        thugs: 40,
        glocks: 8,
        uzis: 4,
        rides: 2,
      },
    });
    cartelsByTag.set(spec.tag, cartel.id);
  }

  for (const [index, tag] of Object.entries(LOCAL_NPC_CARTEL_ASSIGNMENTS)) {
    const player = playersByIndex.get(Number(index));
    const cartelId = cartelsByTag.get(tag);
    if (!player || !cartelId) continue;

    await prisma.player.update({
      where: { id: player.id },
      data: {
        cartelId,
        cartelDonationPercent: index % 3 === 0 ? 10 : 5,
      },
    });
  }
}

export interface LocalNpcSeedReport {
  created: number;
  skipped: number;
  refreshed: number;
  removed: number;
  cartels: number;
  netWorthByTier: Record<string, number[]>;
  districtCounts: Record<string, number>;
  factionMembers: number;
  archetypes: Record<NpcArchetypeId, number>;
}

export async function seedLocalNpcs(
  prisma: PrismaClient,
  options?: { reset?: boolean; refreshExisting?: boolean },
): Promise<LocalNpcSeedReport> {
  const reset = options?.reset ?? false;
  const refreshExisting = options?.refreshExisting ?? false;

  let removed = 0;
  if (reset) {
    removed = await resetLocalNpcFixtures(prisma);
  }

  const season = await prisma.season.findFirst({
    where: { status: SeasonStatus.ACTIVE },
    orderBy: { number: 'desc' },
  });
  if (!season) throw new Error('No active season — run npm run db:seed first');

  const districts = await prisma.district.findMany();
  const districtMap = new Map(districts.map((d) => [d.slug, d]));

  let created = 0;
  let skipped = 0;
  let refreshed = 0;

  const netWorthByTier: Record<string, number[]> = {
    low: [],
    'lower-mid': [],
    mid: [],
    'upper-mid': [],
    strong: [],
  };
  const districtCounts: Record<string, number> = {};
  const archetypes: Record<NpcArchetypeId, number> = {
    STREET_HUSTLER: 0,
    ENFORCER: 0,
    OPERATOR: 0,
    KINGPIN: 0,
    SYNDICATE_BOSS: 0,
  };

  const playersByIndex = new Map<number, { id: string; districtSlug: string }>();

  for (let i = 0; i < LOCAL_NPC_COUNT; i++) {
    const alias = localNpcAlias(i);
    const aliasNorm = normalizeAlias(alias);
    const districtSlug = LOCAL_NPC_DISTRICT_SLUGS[i % LOCAL_NPC_DISTRICT_SLUGS.length]!;
    const meta = progressionMetaForLocalSlot(i);
    archetypes[meta.archetype] += 1;
    districtCounts[districtSlug] = (districtCounts[districtSlug] ?? 0) + 1;

    const existing = await prisma.player.findUnique({
      where: { aliasNormalized: aliasNorm },
      include: { user: true },
    });

    if (existing) {
      if (!isLocalNpcSeedEmail(existing.user.email)) {
        throw new Error(
          `Alias collision: ${alias} exists but is not a local-npc fixture (${existing.user.email}).`,
        );
      }

      skipped++;
      playersByIndex.set(i, { id: existing.id, districtSlug });

      await prisma.player.update({
        where: { id: existing.id },
        data: {
          avatar: resolveNpcSeedAvatar(aliasNorm),
          avatarSource: PlayerAvatarSource.CHARACTER,
          pfpUrl: null,
          themePrimary: null,
          themeSecondary: null,
          isSystemPlayer: false,
        },
      });

      if (refreshExisting || reset) {
        await applyNpcTargetStateToPlayer(prisma, {
          playerId: existing.id,
          districtId: existing.districtId,
          seasonId: season.id,
          archetype: meta.archetype,
          ladderSlot: meta.ladderSlot,
          growthSeed: meta.growthSeed,
          roundDay: roundDayForLocalSlot(meta.ladderSlot),
          totalSlots: LOCAL_NPC_COUNT,
          nwBand: LOCAL_NPC_NW_BAND,
        });
        refreshed++;
      }

      const patch = LOCAL_NPC_EDGE_PATCHES[i];
      if (patch) {
        await prisma.player.update({
          where: { id: existing.id },
          data: {
            travelling: patch.travelling ?? false,
            ...(patch.bankCash != null ? { bankCash: patch.bankCash } : {}),
            ...(patch.cash != null ? { cash: patch.cash } : {}),
          },
        });
        if (patch.lastSeenHoursAgo != null) {
          await prisma.playerStatusExt.upsert({
            where: { playerId: existing.id },
            create: {
              playerId: existing.id,
              lastSeenAt: new Date(Date.now() - patch.lastSeenHoursAgo * 60 * 60 * 1000),
            },
            update: {
              lastSeenAt: new Date(Date.now() - patch.lastSeenHoursAgo * 60 * 60 * 1000),
            },
          });
        }
      }

      const refreshedPlayer = await prisma.player.findUniqueOrThrow({
        where: { id: existing.id },
        include: { ownedBusinesses: true },
      });
      const bizAgg = aggregateBusinessNwContext(refreshedPlayer.ownedBusinesses);
      const nw = calculateCanonicalNetWorthFromPlayer(refreshedPlayer, {
        streetWorkers: refreshedPlayer.prostitutes,
        ...bizAgg,
      });
      bucketNetWorth(netWorthByTier, nw);
      continue;
    }

    const district = districtMap.get(districtSlug);
    if (!district) throw new Error(`District not found: ${districtSlug}`);

    const user = await prisma.user.create({
      data: {
        email: localNpcEmail(aliasNorm),
        passwordHash: await hashPassword(`local-npc-${aliasNorm}-not-for-login`),
        role: 'PLAYER',
      },
    });

    const avatarId = resolveNpcSeedAvatar(aliasNorm);
    const player = await prisma.player.create({
      data: {
        userId: user.id,
        alias,
        aliasNormalized: aliasNorm,
        districtId: district.id,
        seasonId: season.id,
        cash: 0,
        prostitutes: 0,
        thugs: 0,
        isSystemPlayer: false,
        avatar: avatarId,
        avatarSource: PlayerAvatarSource.CHARACTER,
        prostitutePayoutPercent: 40 + (i % 4) * 5,
      },
    });

    playersByIndex.set(i, { id: player.id, districtSlug });

    const initialTurns = createInitialTurnState();
    await prisma.playerTurnState.create({
      data: {
        playerId: player.id,
        currentTurns: initialTurns.currentTurns,
        lastRegeneratedAt: initialTurns.lastRegeneratedAt,
        turnCap: TURNS_CONFIG.turnCap,
        regenerationRate: TURNS_CONFIG.regenerationRatePerMs,
      },
    });

    await applyNpcTargetStateToPlayer(prisma, {
      playerId: player.id,
      districtId: district.id,
      seasonId: season.id,
      archetype: meta.archetype,
      ladderSlot: meta.ladderSlot,
      growthSeed: meta.growthSeed,
      roundDay: roundDayForLocalSlot(meta.ladderSlot),
      totalSlots: LOCAL_NPC_COUNT,
      nwBand: LOCAL_NPC_NW_BAND,
    });

    const patch = LOCAL_NPC_EDGE_PATCHES[i];
    if (patch) {
      await prisma.player.update({
        where: { id: player.id },
        data: {
          travelling: patch.travelling ?? false,
          ...(patch.bankCash != null ? { bankCash: patch.bankCash } : {}),
          ...(patch.cash != null ? { cash: patch.cash } : {}),
        },
      });
      if (patch.lastSeenHoursAgo != null) {
        await prisma.playerStatusExt.create({
          data: {
            playerId: player.id,
            lastSeenAt: new Date(Date.now() - patch.lastSeenHoursAgo * 60 * 60 * 1000),
          },
        });
      }
    } else {
      await prisma.playerStatusExt.create({
        data: {
          playerId: player.id,
          lastSeenAt: new Date(Date.now() - (i % 5) * 3 * 60 * 60 * 1000),
        },
      });
    }

    const playerAfterSeed = await prisma.player.findUniqueOrThrow({
      where: { id: player.id },
      include: { ownedBusinesses: true },
    });
    const bizAgg = aggregateBusinessNwContext(playerAfterSeed.ownedBusinesses);
    const nw = calculateCanonicalNetWorthFromPlayer(playerAfterSeed, {
      streetWorkers: playerAfterSeed.prostitutes,
      ...bizAgg,
    });
    bucketNetWorth(netWorthByTier, nw);
    await createRankSnapshots(prisma, player.id, season.id, nw, i * 1337);

    created++;
    console.log(
      `  + ${alias} (${district.name}) — ${meta.archetype} NW $${nw.toLocaleString()}`,
    );
  }

  await ensureLocalFixtureCartels(prisma, playersByIndex);

  const factionMembers = await prisma.player.count({
    where: {
      user: { email: { startsWith: LOCAL_NPC_EMAIL_PREFIX } },
      cartelId: { not: null },
    },
  });

  const cartels = await prisma.cartel.count({
    where: { tag: { in: [...LOCAL_FIXTURE_CARTEL_TAGS] } },
  });

  return {
    created,
    skipped,
    refreshed,
    removed,
    cartels,
    netWorthByTier,
    districtCounts,
    factionMembers,
    archetypes,
  };
}

function bucketNetWorth(buckets: Record<string, number[]>, nw: number) {
  if (nw < 15_000) buckets.low!.push(nw);
  else if (nw < 40_000) buckets['lower-mid']!.push(nw);
  else if (nw < 90_000) buckets.mid!.push(nw);
  else if (nw < 160_000) buckets['upper-mid']!.push(nw);
  else buckets.strong!.push(nw);
}

export function formatLocalNpcSeedReport(report: LocalNpcSeedReport): string {
  const lines = [
    `Local NPC seed: ${report.created} created, ${report.skipped} already existed, ${report.refreshed} refreshed${report.removed ? `, ${report.removed} removed before seed` : ''}.`,
    `Cartels: ${report.cartels} (${report.factionMembers} fixture members in factions).`,
    `Districts: ${JSON.stringify(report.districtCounts)}`,
    `Archetypes: ${JSON.stringify(report.archetypes)}`,
    'NW tiers (canonical):',
  ];

  for (const [tier, values] of Object.entries(report.netWorthByTier)) {
    if (values.length === 0) continue;
    const min = Math.min(...values);
    const max = Math.max(...values);
    lines.push(`  ${tier}: ${values.length} players ($${min.toLocaleString()} – $${max.toLocaleString()})`);
  }

  return lines.join('\n');
}
