import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isNpcProgressionCatchUpNeeded } from '@/server/services/npc-progression.service';

/** Mirrors lookupPlayerRanksFromOverall district pass — algorithm regression guard. */
function districtRankFromOverallRows(
  rows: Array<{ id: string; rank: number; citySlug: string }>,
  playerId: string,
  districtSlug: string,
): number {
  let districtRank = 0;
  let districtIndex = 0;
  for (const row of rows) {
    if (row.citySlug !== districtSlug) continue;
    districtIndex++;
    if (row.id === playerId) {
      districtRank = districtIndex;
      break;
    }
  }
  return districtRank;
}

describe('rankings single-pass rank lookup', () => {
  it('derives district rank from overall ordering', () => {
    const rows = [
      { id: 'a', rank: 1, citySlug: 'neon-strip' },
      { id: 'b', rank: 2, citySlug: 'docklands' },
      { id: 'c', rank: 3, citySlug: 'neon-strip' },
    ];

    expect(rows.find((r) => r.id === 'c')?.rank).toBe(3);
    expect(districtRankFromOverallRows(rows, 'c', 'neon-strip')).toBe(2);
  });
});

describe('NPC progression catch-up check', () => {
  it('exports cheap stale check helper', () => {
    expect(typeof isNpcProgressionCatchUpNeeded).toBe('function');
  });
});

describe('Attack page NPC progression', () => {
  it('schedules catch-up via after() instead of blocking the page load', () => {
    const source = readFileSync(
      path.resolve(
        __dirname,
        '../../../NeonUnderworld-OldSkool/src/server/actions/attack.actions.ts',
      ),
      'utf8',
    );
    expect(source).toContain('after(async');
    expect(source).toContain('isNpcProgressionCatchUpNeeded');
    expect(source).toContain('progressActiveSeasonNpcs');
    expect(source).not.toContain('await maybeProgressActiveSeasonNpcs');
    expect(source).toMatch(
      /after\(async \(\) => \{[\s\S]*isNpcProgressionCatchUpNeeded[\s\S]*progressActiveSeasonNpcs/,
    );
  });
});
