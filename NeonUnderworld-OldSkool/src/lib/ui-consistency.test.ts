import { describe, it, expect } from 'vitest';
import { heatBadgeTone } from '@local/components/game/StatusBadge';

describe('Pass 3 UI consistency', () => {
  it('maps heat bands to readable badge tones', () => {
    expect(heatBadgeTone('CRITICAL')).toBe('danger');
    expect(heatBadgeTone('HIGH')).toBe('warn');
    expect(heatBadgeTone('LOW')).toBe('success');
  });

  it('exports shared selection and tab primitives', async () => {
    const game = await import('@local/components/game');
    expect(game.SelectableCard).toBeDefined();
    expect(game.OptionGrid).toBeDefined();
    expect(game.FilterPills).toBeDefined();
    expect(game.SimpleTabs).toBeDefined();
    expect(game.StatusBadge).toBeDefined();
    expect(game.FeedbackNote).toBeDefined();
    expect(game.EmptyState).toBeDefined();
  });
});

describe('route backgrounds', () => {
  it('maps businesses to empire artwork', async () => {
    const { getBackgroundForPath } = await import('@local/config/route-backgrounds');
    expect(getBackgroundForPath('/businesses')).toBe('empire');
  });
});
