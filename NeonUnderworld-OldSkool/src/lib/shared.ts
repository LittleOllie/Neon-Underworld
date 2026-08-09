/** Re-export shared game engine — single source of truth */
export * from '@core/lib/game-engine/turns';
export * from '@core/lib/game-engine/net-worth';
export * from '@core/lib/game-engine/scouting';
export * from '@core/lib/game-engine/rng';
export * from '@core/lib/game-engine/errors';
export * from '@core/lib/game-engine/state';
export * from '@core/config/game/balance';
export * from '@core/config/game/terminology';
export * from '@core/lib/game/season-display';
export { calculateProstituteHappiness, calculateThugHappiness } from '@core/lib/game-engine/happiness';
