import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

const DEFAULT_MAX_ATTEMPTS = 3;

function isSerializationFailure(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034'
  );
}

function retryDelayMs(attempt: number): number {
  return 40 * attempt;
}

/** Serializable transaction with automatic retry on Prisma P2034 write conflicts. */
export async function runSerializableTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable' });
    } catch (error) {
      lastError = error;
      if (isSerializationFailure(error) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export function isRetryableGameplayConflict(message: string): boolean {
  return message.includes('conflicted with another update');
}
