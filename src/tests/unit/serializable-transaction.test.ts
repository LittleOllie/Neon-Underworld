import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import {
  COMBAT_TRANSACTION_OPTIONS,
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

  it('retries after a connection pool timeout', async () => {
    mockTransaction
      .mockRejectedValueOnce(new Error('Timed out fetching a new connection from the connection pool'))
      .mockImplementationOnce(async (fn: (tx: object) => Promise<string>) => fn({}));

    const result = await runSerializableTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('passes maxWait and timeout options to prisma', async () => {
    mockTransaction.mockImplementationOnce(async (fn: (tx: object) => Promise<string>) => fn({}));

    await runSerializableTransaction(async () => 'ok', COMBAT_TRANSACTION_OPTIONS);

    expect(mockTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        maxWait: COMBAT_TRANSACTION_OPTIONS.maxWait,
        timeout: COMBAT_TRANSACTION_OPTIONS.timeout,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }),
    );
  });

  it('throws non-retryable errors immediately', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('boom'));

    await expect(runSerializableTransaction(async () => 'ok')).rejects.toThrow('boom');
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableGameplayConflict', () => {
  it('matches player-safe retry messages', () => {
    expect(
      isRetryableGameplayConflict('That action conflicted with another update. Please try again.'),
    ).toBe(true);
    expect(isRetryableGameplayConflict('The server is busy. Please try again in a moment.')).toBe(true);
    expect(isRetryableGameplayConflict('You only have 10 turns.')).toBe(false);
  });
});
