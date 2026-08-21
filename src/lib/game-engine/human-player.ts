import type { Prisma } from '@prisma/client';
import { isNpcManagedAccount } from '@/lib/game-engine/npc-avatar';

export type HumanPlayerInput = {
  isSystemPlayer: boolean;
  email?: string | null;
};

/** True for real human accounts — excludes system filler and seeded NPC opponents. */
export function isHumanPlayer(input: HumanPlayerInput): boolean {
  if (input.isSystemPlayer) return false;
  const email = input.email ?? '';
  return !isNpcManagedAccount({ isSystemPlayer: false, email });
}

/** Prisma where fragment for human players in the active season. */
export function humanPlayerWhere(seasonId: string): Prisma.PlayerWhereInput {
  return {
    seasonId,
    isSystemPlayer: false,
    NOT: {
      OR: [
        { user: { email: { startsWith: 'system+' } } },
        { user: { email: { startsWith: 'playtest-npc+' } } },
        { user: { email: { startsWith: 'dev-pvp+' } } },
        { user: { email: { startsWith: 'local-npc+' } } },
      ],
    },
  };
}

/**
 * Rankings / PvP lists when round activation is enforced — humans must be activated; NPC fixtures always visible.
 */
export function isVisibleSeasonParticipant(
  player: HumanPlayerInput & { id: string },
  activatedHumanIds: Set<string> | null,
): boolean {
  if (!activatedHumanIds) return true;
  if (!isHumanPlayer(player)) return true;
  return activatedHumanIds.has(player.id);
}

/** Activated humans — uses round-activation column when admin migration is applied. */
export function activatedHumanPlayerWhere(seasonId: string): Prisma.PlayerWhereInput {
  return humanPlayerWhere(seasonId);
}
