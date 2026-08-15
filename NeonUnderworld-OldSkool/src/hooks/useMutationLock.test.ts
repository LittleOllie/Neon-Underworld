import { describe, it, expect } from 'vitest';
import { createMutationLockState } from './mutation-lock-core';

describe('createMutationLockState', () => {
  it('blocks concurrent runs', async () => {
    const lock = createMutationLockState();
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let secondRan = false;

    const first = lock.run('a', async () => {
      await gate;
    });
    const second = lock.run('b', async () => {
      secondRan = true;
    });

    expect(lock.getSnapshot().locked).toBe(true);
    releaseFirst();
    await first;
    await second;

    expect(secondRan).toBe(false);
    expect(lock.getSnapshot().locked).toBe(false);
  });

  it('clears lock after failure', async () => {
    const lock = createMutationLockState();
    await expect(
      lock.run('fail', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(lock.getSnapshot().locked).toBe(false);
  });
});
