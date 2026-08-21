import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SeasonStatus } from '@prisma/client';
import {
  PLAYTEST_NPC_EMAIL_PREFIX,
  PlaytestNpcSeasonError,
  reattachPlaytestNpcsToActiveSeason,
  requireExactlyOneActiveSeason,
} from '@/lib/game-engine/playtest-npc-season';

function mockPrisma(overrides: {
  activeSeasons?: Array<{ id: string; number: number }>;
  playtestPlayers?: Array<{ id: string; seasonId: string }>;
  previousSeasons?: Array<{ id: string; number: number }>;
}) {
  const updateMany = vi.fn().mockResolvedValue({ count: 0 });
  const playerUpdate = vi.fn().mockResolvedValue({});

  const prisma = {
    season: {
      findMany: vi.fn(async (args: { where?: { status?: SeasonStatus; id?: { in: string[] } } }) => {
        if (args.where?.status === SeasonStatus.ACTIVE) {
          return overrides.activeSeasons ?? [];
        }
        if (args.where?.id?.in) {
          return overrides.previousSeasons ?? [];
        }
        return [];
      }),
    },
    player: {
      findMany: vi.fn(async () => overrides.playtestPlayers ?? []),
      updateMany,
      update: playerUpdate,
    },
  };

  return { prisma: prisma as never, updateMany, playerUpdate };
}

describe('requireExactlyOneActiveSeason', () => {
  it('throws when no active season exists', async () => {
    const { prisma } = mockPrisma({ activeSeasons: [] });
    await expect(requireExactlyOneActiveSeason(prisma)).rejects.toThrow(PlaytestNpcSeasonError);
  });

  it('throws when multiple active seasons exist', async () => {
    const { prisma } = mockPrisma({
      activeSeasons: [
        { id: 's1', number: 1 },
        { id: 's2', number: 2 },
      ],
    });
    await expect(requireExactlyOneActiveSeason(prisma)).rejects.toThrow(/exactly one active season/);
  });

  it('returns the sole active season', async () => {
    const { prisma } = mockPrisma({ activeSeasons: [{ id: 'active', number: 12004 }] });
    await expect(requireExactlyOneActiveSeason(prisma)).resolves.toEqual({
      id: 'active',
      number: 12004,
    });
  });
});

describe('reattachPlaytestNpcsToActiveSeason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reattaches playtest NPCs on an ended season to the active season', async () => {
    const { prisma, updateMany } = mockPrisma({
      activeSeasons: [{ id: 'active', number: 12004 }],
      playtestPlayers: [
        { id: 'npc-1', seasonId: 'ended' },
        { id: 'npc-2', seasonId: 'ended' },
      ],
      previousSeasons: [{ id: 'ended', number: 13005 }],
    });

    const result = await reattachPlaytestNpcsToActiveSeason(prisma, {
      id: 'active',
      number: 12004,
    });

    expect(result.moved).toBe(2);
    expect(result.alreadyOnActive).toBe(0);
    expect(result.previousSeasons).toEqual([
      { seasonId: 'ended', seasonNumber: 13005, count: 2 },
    ]);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['npc-1', 'npc-2'] } },
      data: { seasonId: 'active' },
    });
  });

  it('leaves playtest NPCs already on the active season unchanged', async () => {
    const { prisma, updateMany } = mockPrisma({
      activeSeasons: [{ id: 'active', number: 12004 }],
      playtestPlayers: [{ id: 'npc-1', seasonId: 'active' }],
    });

    const result = await reattachPlaytestNpcsToActiveSeason(prisma, {
      id: 'active',
      number: 12004,
    });

    expect(result.moved).toBe(0);
    expect(result.alreadyOnActive).toBe(1);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('only queries playtest-npc+ email prefix', async () => {
    const { prisma } = mockPrisma({
      activeSeasons: [{ id: 'active', number: 12004 }],
      playtestPlayers: [],
    });

    await reattachPlaytestNpcsToActiveSeason(prisma, { id: 'active', number: 12004 });

    expect(prisma.player.findMany).toHaveBeenCalledWith({
      where: { user: { email: { startsWith: PLAYTEST_NPC_EMAIL_PREFIX } } },
      select: { id: true, seasonId: true },
    });
  });

  it('updates seasonId in bulk without creating records', async () => {
    const { prisma, updateMany } = mockPrisma({
      activeSeasons: [{ id: 'active', number: 12004 }],
      playtestPlayers: [{ id: 'npc-1', seasonId: 'ended' }],
      previousSeasons: [{ id: 'ended', number: 13005 }],
    });

    await reattachPlaytestNpcsToActiveSeason(prisma, { id: 'active', number: 12004 });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(Object.keys(prisma as object)).toEqual(['season', 'player']);
  });
});
