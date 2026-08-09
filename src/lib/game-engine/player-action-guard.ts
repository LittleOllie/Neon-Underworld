import { ATTACK_RULES } from '@/config/game/attack-rules';
import { GameplayError } from './gameplay-errors';

export interface PlayerActionContext {
  lifeStatus: string;
  travelling: boolean;
}

/**
 * Shared guard for turn-spending actions (scout, produce, shop purchase, etc.).
 * Aligns with shop and attack restrictions — active life status, not travelling.
 */
export function assertPlayerCanPerformAction(player: PlayerActionContext): void {
  if (ATTACK_RULES.blockedAttackerLifeStatuses.includes(player.lifeStatus as never)) {
    throw new GameplayError('PLAYER_INCAPACITATED');
  }
  if (player.travelling) {
    throw new GameplayError('PLAYER_TRAVELLING');
  }
}
