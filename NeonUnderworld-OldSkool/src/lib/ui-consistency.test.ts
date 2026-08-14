import { describe, it, expect } from 'vitest';
import { heatBadgeTone } from '@local/components/game/StatusBadge';

describe('Pass 3 UI consistency', () => {
  it('maps heat bands to readable badge tones', () => {
    expect(heatBadgeTone('CRITICAL')).toBe('danger');
    expect(heatBadgeTone('HIGH')).toBe('warn');
    expect(heatBadgeTone('LOW')).toBe('success');
  });

  it('exports shared selection and tab primitives', async () => {
    const [
      { SelectableCard },
      { OptionGrid },
      { FilterPills },
      { SimpleTabs },
      { StatusBadge },
      { FeedbackNote },
      { EmptyState },
    ] = await Promise.all([
      import('@local/components/game/SelectableCard'),
      import('@local/components/game/OptionGrid'),
      import('@local/components/game/FilterPills'),
      import('@local/components/game/SimpleTabs'),
      import('@local/components/game/StatusBadge'),
      import('@local/components/game/FeedbackNote'),
      import('@local/components/game/EmptyState'),
    ]);
    expect(SelectableCard).toBeDefined();
    expect(OptionGrid).toBeDefined();
    expect(FilterPills).toBeDefined();
    expect(SimpleTabs).toBeDefined();
    expect(StatusBadge).toBeDefined();
    expect(FeedbackNote).toBeDefined();
    expect(EmptyState).toBeDefined();
  });
});

describe('route backgrounds', () => {
  it('maps businesses to empire artwork', async () => {
    const { getBackgroundForPath } = await import('@local/config/route-backgrounds');
    expect(getBackgroundForPath('/businesses')).toBe('empire');
  });
});
