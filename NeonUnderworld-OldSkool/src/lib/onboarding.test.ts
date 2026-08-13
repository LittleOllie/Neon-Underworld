import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@core/lib/db/prisma', () => ({
  prisma: {
    gameAction: {
      findFirst: mocks.findFirst,
      count: mocks.count,
    },
  },
}));

import {
  hasCompletedScout,
  getOnboardingState,
} from './onboarding';

describe('onboarding', () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.count.mockReset();
  });

  it('detects new player without scout action', async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(hasCompletedScout('p1')).resolves.toBe(false);
  });

  it('detects player with completed scout', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'ga1' });
    await expect(hasCompletedScout('p1')).resolves.toBe(true);
  });

  it('returns first-move before any scout', async () => {
    mocks.findFirst.mockResolvedValue(null);
    mocks.count.mockResolvedValue(0);
    await expect(getOnboardingState('p1')).resolves.toEqual({ phase: 'first-move' });
  });

  it('returns next-move after first scout only', async () => {
    mocks.findFirst
      .mockResolvedValueOnce({ id: 'ga1' })
      .mockResolvedValueOnce(null);
    mocks.count.mockResolvedValue(1);
    await expect(getOnboardingState('p1')).resolves.toEqual({ phase: 'next-move' });
  });

  it('returns none after scout and produce', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'x' });
    mocks.count.mockResolvedValue(3);
    await expect(getOnboardingState('p1')).resolves.toEqual({ phase: 'none' });
  });
});
