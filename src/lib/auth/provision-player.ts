import type { PrismaClient } from '@prisma/client';
import { STARTING_RESOURCES } from '@/config/game/balance';
import { createInitialTurnState } from '@/lib/game-engine/turns';
import {
  calculateProstituteHappiness,
  calculateThugHappiness,
} from '@/lib/game-engine/happiness';
import { snapshotPlayerState } from '@/lib/game-engine/state';
import { resolveRegistrationSeason } from '@/lib/game-engine/season-guard';
import { normalizeAlias, sanitizeText } from '@/lib/security/crypto';

const AUTH_ALIAS_MAX = 20;
const DEFAULT_OAUTH_DISTRICT_SLUG = 'neon-strip';

export interface ProvisionPlayerInput {
  userId: string;
  alias: string;
  districtSlug?: string;
  auditSource: 'registration' | 'google_oauth';
}

export interface ProvisionedPlayer {
  playerId: string;
  alias: string;
  aliasNormalized: string;
  districtSlug: string;
  seasonId: string;
}

export async function provisionNewPlayer(
  db: PrismaClient,
  input: ProvisionPlayerInput,
): Promise<ProvisionedPlayer> {
  const alias = sanitizeText(input.alias, AUTH_ALIAS_MAX);
  const aliasNormalized = normalizeAlias(alias);

  const existingAlias = await db.player.findUnique({ where: { aliasNormalized } });
  if (existingAlias) {
    throw new Error('ALIAS_TAKEN');
  }

  const districtSlug = input.districtSlug ?? DEFAULT_OAUTH_DISTRICT_SLUG;
  const district = await db.district.findFirst({
    where: { slug: districtSlug, active: true },
  });
  if (!district) {
    throw new Error('DISTRICT_UNAVAILABLE');
  }

  const season = await resolveRegistrationSeason();
  if (!season) {
    throw new Error('NO_ACTIVE_SEASON');
  }

  const initialTurns = createInitialTurnState();
  const prostituteHappiness = calculateProstituteHappiness({
    prostitutes: STARTING_RESOURCES.prostitutes,
    thugs: STARTING_RESOURCES.thugs,
    hash: STARTING_RESOURCES.hash,
    condoms: STARTING_RESOURCES.condoms,
    prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
  }).score;

  const thugHappiness = calculateThugHappiness({
    thugs: STARTING_RESOURCES.thugs,
    glocks: STARTING_RESOURCES.glocks,
    uzis: STARTING_RESOURCES.uzis,
    aks: STARTING_RESOURCES.aks,
    beer: STARTING_RESOURCES.beer,
  }).score;

  const player = await db.$transaction(async (tx) => {
    const created = await tx.player.create({
      data: {
        userId: input.userId,
        alias,
        aliasNormalized,
        districtId: district.id,
        seasonId: season.id,
        cash: STARTING_RESOURCES.cash,
        prostitutes: STARTING_RESOURCES.prostitutes,
        thugs: STARTING_RESOURCES.thugs,
        rides: STARTING_RESOURCES.rides,
        glocks: STARTING_RESOURCES.glocks,
        uzis: STARTING_RESOURCES.uzis,
        aks: STARTING_RESOURCES.aks,
        beer: STARTING_RESOURCES.beer,
        condoms: STARTING_RESOURCES.condoms,
        hash: STARTING_RESOURCES.hash,
        shrooms: STARTING_RESOURCES.shrooms,
        coke: STARTING_RESOURCES.coke,
        heroin: STARTING_RESOURCES.heroin,
        prostitutePayoutPercent: STARTING_RESOURCES.prostitutePayoutPercent,
        prostituteHappiness,
        thugHappiness,
      },
    });

    await tx.playerTurnState.create({
      data: {
        playerId: created.id,
        currentTurns: initialTurns.currentTurns,
        lastRegeneratedAt: initialTurns.lastRegeneratedAt,
        turnCap: initialTurns.turnCap,
        regenerationRate: initialTurns.regenerationRatePerMs,
      },
    });

    await tx.economicAuditLog.create({
      data: {
        playerId: created.id,
        userId: input.userId,
        eventType: 'PLAYER_REGISTERED',
        source: input.auditSource,
        beforeState: {},
        delta: snapshotPlayerState({
          cash: STARTING_RESOURCES.cash,
          prostitutes: STARTING_RESOURCES.prostitutes,
          thugs: STARTING_RESOURCES.thugs,
        }) as object,
        afterState: snapshotPlayerState({
          cash: STARTING_RESOURCES.cash,
          prostitutes: STARTING_RESOURCES.prostitutes,
          thugs: STARTING_RESOURCES.thugs,
        }) as object,
        metadata: { districtSlug: district.slug, alias, via: input.auditSource },
      },
    });

    return created;
  });

  return {
    playerId: player.id,
    alias: player.alias,
    aliasNormalized: player.aliasNormalized,
    districtSlug: district.slug,
    seasonId: season.id,
  };
}

/** Build a unique alias from an email local-part for OAuth provisioning. */
export async function generateUniqueAliasFromEmail(
  db: PrismaClient,
  email: string,
): Promise<string> {
  const local = email.split('@')[0] ?? 'operator';
  const base = sanitizeText(local.replace(/[^a-zA-Z0-9]/g, ''), AUTH_ALIAS_MAX) || 'Operator';
  const capped = base.slice(0, AUTH_ALIAS_MAX - 2);

  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = attempt === 0 ? '' : String(attempt);
    const candidate = `${capped.slice(0, AUTH_ALIAS_MAX - suffix.length)}${suffix}`;
    const normalized = normalizeAlias(candidate);
    const taken = await db.player.findUnique({ where: { aliasNormalized: normalized } });
    if (!taken) return candidate;
  }

  throw new Error('ALIAS_EXHAUSTED');
}
