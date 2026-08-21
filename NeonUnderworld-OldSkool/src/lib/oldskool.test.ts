import { describe, it, expect } from 'vitest';
import { TERMS } from '@core/config/game/terminology';

describe('OldSkool terminology', () => {
  it('uses shared faction term from core engine', () => {
    expect(TERMS.cartel).toBe('Faction');
  });

  it('uses shared scout term', () => {
    expect(TERMS.scout).toBe('Scout');
  });
});

describe('OldSkool navigation routes', () => {
  const routes = ['/command', '/scout', '/empire', '/rankings', '/operations'];

  it('defines core game routes', () => {
    expect(routes).toContain('/command');
    expect(routes).toContain('/scout');
    expect(routes).toContain('/empire');
  });
});
