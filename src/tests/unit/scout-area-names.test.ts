import { describe, it, expect } from 'vitest';
import { getDistrictScoutAreaName } from '@/config/game/scout-area-names';
import { getScoutAreaDisplays } from '@/lib/game-engine/scout-display';

describe('district scout area names', () => {
  it('returns unique names per district for the same area slug', () => {
    const neonStreets = getDistrictScoutAreaName('neon-strip', 'streets');
    const dockStreets = getDistrictScoutAreaName('docklands', 'streets');
    const quarterStreets = getDistrictScoutAreaName('old-quarter', 'streets');

    expect(neonStreets).toBe('The Neon Strip');
    expect(dockStreets).toBe('Freight Row');
    expect(quarterStreets).toBe('Cobblestone Lane');
    expect(new Set([neonStreets, dockStreets, quarterStreets]).size).toBe(3);
  });

  it('feeds district names into scout area displays', () => {
    const neon = getScoutAreaDisplays('neon-strip');
    const docks = getScoutAreaDisplays('docklands');

    expect(neon.find((a) => a.slug === 'docks')?.name).toBe('Canal Promenade');
    expect(docks.find((a) => a.slug === 'docks')?.name).toBe('Container Yard');
  });
});
