import { NPC_LADDER_TOTAL_SLOTS } from '@/config/game/npc-progression-rules';

export const PLAYTEST_NPC_DISTRICT_SLUGS = ['neon-strip', 'docklands', 'old-quarter'] as const;

export type PlaytestNpcDistrictSlug = (typeof PLAYTEST_NPC_DISTRICT_SLUGS)[number];

/**
 * Spread ladder tiers across districts — each district gets low, mid, and high slots
 * instead of round-robin index order (which clusters similar tiers).
 */
export function districtSlugForLadderSlot(
  ladderSlot: number,
  totalSlots: number = NPC_LADDER_TOTAL_SLOTS,
): PlaytestNpcDistrictSlug {
  const districts = PLAYTEST_NPC_DISTRICT_SLUGS;
  const tierCount = districts.length;
  const tierSize = Math.ceil(totalSlots / tierCount);
  const tier = Math.min(tierCount - 1, Math.floor(ladderSlot / tierSize));
  const posInTier = ladderSlot % tierSize;
  return districts[(tier + posInTier) % tierCount]!;
}
