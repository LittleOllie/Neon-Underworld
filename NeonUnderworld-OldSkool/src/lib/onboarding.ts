import { prisma } from '@core/lib/db/prisma';

/** Player has not completed a district Scout action yet. */
export async function hasCompletedScout(playerId: string): Promise<boolean> {
  const action = await prisma.gameAction.findFirst({
    where: { playerId, actionType: 'SCOUT' },
    select: { id: true },
  });
  return action != null;
}

export async function getScoutActionCount(playerId: string): Promise<number> {
  return prisma.gameAction.count({
    where: { playerId, actionType: 'SCOUT' },
  });
}

export async function hasCompletedProduce(playerId: string): Promise<boolean> {
  const action = await prisma.gameAction.findFirst({
    where: { playerId, actionType: 'PRODUCTION' },
    select: { id: true },
  });
  return action != null;
}

export type OnboardingState =
  | { phase: 'first-move' }
  | { phase: 'next-move' }
  | { phase: 'none' };

/** Derives onboarding UI from gameplay history — no schema flag. */
export async function getOnboardingState(playerId: string): Promise<OnboardingState> {
  const [scouted, scoutCount, produced] = await Promise.all([
    hasCompletedScout(playerId),
    getScoutActionCount(playerId),
    hasCompletedProduce(playerId),
  ]);

  if (!scouted) return { phase: 'first-move' };
  if (scoutCount === 1 && !produced) return { phase: 'next-move' };
  return { phase: 'none' };
}
