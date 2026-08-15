import { describe, it, expect, vi } from 'vitest';
import { createMutationLockState } from '@local/hooks/mutation-lock-core';

describe('action pending guards (rapid click simulation)', () => {
  it('serializes scout-like mutations', async () => {
    const lock = createMutationLockState();
    const scoutAction = vi.fn().mockResolvedValue(undefined);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = lock.run('scout', async () => {
      await gate;
      await scoutAction();
    });
    const second = lock.run('scout', async () => {
      await scoutAction();
    });

    expect(lock.getSnapshot().locked).toBe(true);
    release();
    await first;
    await second;

    expect(scoutAction).toHaveBeenCalledTimes(1);
  });

  it('serializes shop panel mutations across different keys', async () => {
    const lock = createMutationLockState();
    const purchase = vi.fn().mockResolvedValue(undefined);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const hashBuy = lock.run('buy-hash', async () => {
      await gate;
      await purchase('hash');
    });
    const beerBuy = lock.run('buy-beer', async () => {
      await purchase('beer');
    });

    release();
    await hashBuy;
    await beerBuy;

    expect(purchase).toHaveBeenCalledTimes(1);
    expect(purchase).toHaveBeenCalledWith('hash');
  });

  it('unlocks after mutation failure for retry', async () => {
    const lock = createMutationLockState();
    const attempt = vi
      .fn()
      .mockRejectedValueOnce(new Error('Not enough cash'))
      .mockResolvedValueOnce(undefined);

    await expect(lock.run('buy', () => attempt())).rejects.toThrow('Not enough cash');
    expect(lock.getSnapshot().locked).toBe(false);

    await lock.run('buy', () => attempt());
    expect(attempt).toHaveBeenCalledTimes(2);
  });
});
