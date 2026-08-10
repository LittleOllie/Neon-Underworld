import { describe, expect, it } from 'vitest';
import { routeLoadingMessage } from '@local/lib/loading-copy';

describe('route loading UX', () => {
  it('does not include artificial delay markers in copy', () => {
    const message = routeLoadingMessage('/shop');
    expect(message).toMatch(/Opening Shop/);
    expect(message).not.toMatch(/please wait|loading\.\.\./i);
  });

  it('covers major game routes', () => {
    for (const path of ['/command', '/empire', '/scout', '/market', '/travel', '/cartels']) {
      expect(routeLoadingMessage(path).length).toBeGreaterThan(5);
    }
  });
});
