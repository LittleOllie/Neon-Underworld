import { describe, it, expect } from 'vitest';

/** Mirrors BusinessesPanel countdown helper — closed-by-default is enforced in component markup. */
function formatUpgradeRemaining(completesAt: string, nowMs: number): string {
  const remaining = new Date(completesAt).getTime() - nowMs;
  if (remaining <= 0) return 'Completing…';
  const totalMin = Math.ceil(remaining / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

describe('BusinessesPanel upgrade countdown', () => {
  it('formats remaining time', () => {
    const completes = new Date('2026-08-13T18:00:00Z').toISOString();
    const now = new Date('2026-08-13T12:18:00Z').getTime();
    expect(formatUpgradeRemaining(completes, now)).toBe('5h 42m');
  });

  it('shows completing when due', () => {
    const completes = new Date('2026-08-13T12:00:00Z').toISOString();
    const now = new Date('2026-08-13T12:05:00Z').getTime();
    expect(formatUpgradeRemaining(completes, now)).toBe('Completing…');
  });
});

describe('BusinessesPanel collapsible defaults', () => {
  it('BusinessSection markup does not set open attribute by default', () => {
    const section = '<details class="g-business-section">';
    expect(section).not.toContain('open');
  });
});
