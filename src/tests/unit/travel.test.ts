import { describe, it, expect } from 'vitest';
import { REDLITE_TRAVEL } from '@/config/game/redlite-rules';
import {
  ridesRequiredForTravel,
  travelCrewPopulation,
  validateTravelDestination,
  travelDestinationsForSlug,
} from '@/lib/game-engine/travel';
import { DISTRICTS } from '@/config/game/balance';

describe('travel rules', () => {
  it('calculates crew population from thugs and workers', () => {
    expect(travelCrewPopulation(10, 5)).toBe(15);
    expect(travelCrewPopulation(-1, 3)).toBe(3);
  });

  it('requires minimum one ride even with no crew', () => {
    expect(ridesRequiredForTravel(0)).toBe(REDLITE_TRAVEL.minRidesRequired);
  });

  it('calculates rides from crew capacity', () => {
    expect(ridesRequiredForTravel(5)).toBe(1);
    expect(ridesRequiredForTravel(6)).toBe(2);
    expect(ridesRequiredForTravel(25)).toBe(5);
    expect(ridesRequiredForTravel(26)).toBe(6);
  });

  it('rejects travel to current city', () => {
    expect(validateTravelDestination('neon-strip', 'neon-strip')).toBe(false);
    expect(validateTravelDestination('neon-strip', 'docklands')).toBe(true);
  });

  it('lists other districts as destinations', () => {
    const dests = travelDestinationsForSlug('neon-strip');
    expect(dests).toHaveLength(DISTRICTS.length - 1);
    expect(dests.every((d) => d.slug !== 'neon-strip')).toBe(true);
  });

  it('documents reusable rides — capacity check only, no consumption', () => {
    expect(REDLITE_TRAVEL.thugsInRidesFree).toBe(true);
  });
});
