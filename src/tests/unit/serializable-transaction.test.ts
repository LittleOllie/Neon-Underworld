import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  isRetryableGameplayConflict,
  runSerializableTransaction,
} from '@/lib/db/serializable-transaction';

const mockTransaction = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

describe('runSerializableTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retries once after a P2034 serialization failure', async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });

    mockTransaction
      .mockRejectedValueOnce(p2034)
      .mockImplementationOnce(async (fn: (tx: object) => Promise<string>) => fn({}));

    const result = await runSerializableTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('throws non-serialization errors immediately', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('boom'));

    await expect(runSerializableTransaction(async () => 'ok')).rejects.toThrow('boom');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableGameplayConflict', () => {
  it('matches the player-safe conflict message', () => {
    expect(
      isRetryableGameplayConflict('That action conflicted with another update. Please try again.'),
    ).toBe(true);
    expect(isRetryableGameplayConflict('You only have 10 turns.')).toBe(false);
  });
});
