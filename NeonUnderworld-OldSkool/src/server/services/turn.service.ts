import {
  settleTurnRegeneration,
  formatTimeUntilNextTurn,
  type TurnState,
  type SettledTurnState,
} from '@core/lib/game-engine/turns';

export type { TurnState, SettledTurnState };

export const TurnService = {
  settle(state: TurnState, now = new Date()): SettledTurnState {
    return settleTurnRegeneration(state, now);
  },

  formatUntilNext(ms: number): string {
    return formatTimeUntilNextTurn(ms);
  },
};
