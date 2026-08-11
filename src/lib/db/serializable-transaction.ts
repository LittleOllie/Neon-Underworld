import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type PrismaTransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];

export interface SerializableTransactionOptions {
  /** Total attempts including the first try. */
  maxAttempts?: number;
  /** Max ms to wait for a pooled connection before starting the transaction. */
  maxWait?: number;
  /** Max ms the interactive transaction may run. */
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<SerializableTransactionOptions> = {
  maxAttempts: 3,
  maxWait: 10_000,
  timeout: 20_000,
};

/** Combat does more work inside one transaction — allow longer waits on serverless Neon. */
export const COMBAT_TRANSACTION_OPTIONS: Required<SerializableTransactionOptions> = {
  maxAttempts: 5,
  maxWait: 15_000,
  timeout: 30_000,
};

function readPrismaErrorCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code;
  if (typeof error === 'object' && error !== null) {
    const candidate = error as { name?: string; code?: string };
    if (candidate.name === 'PrismaClientKnownRequestError' && typeof candidate.code === 'string') {
      return candidate.code;
    }
    if (typeof candidate.code === 'string') return candidate.code;
  }
  return null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && typeof (error as { message?: string }).message === 'string') {
    return (error as { message: string }).message;
  }
  if (typeof error === 'string') return error;
  return '';
}

function isSerializationFailure(error: unknown): boolean {
  if (readPrismaErrorCode(error) === 'P2034') return true;
  const normalized = errorMessage(error).toLowerCase();
  return (
    normalized.includes('could not serialize') ||
    normalized.includes('serialization failure') ||
    normalized.includes('deadlock')
  );
}

function isPoolOrTransactionTimeout(error: unknown): boolean {
  const code = readPrismaErrorCode(error);
  if (code === 'P2028') return true;
  const normalized = errorMessage(error).toLowerCase();
  return (
    normalized.includes('connection pool') ||
    normalized.includes('timed out fetching') ||
    normalized.includes('transaction api error') ||
    normalized.includes('unable to start a transaction') ||
    normalized.includes('expired transaction') ||
    normalized.includes('closed the connection')
  );
}

function isRetryableTransactionError(error: unknown): boolean {
  return isSerializationFailure(error) || isPoolOrTransactionTimeout(error);
}

function retryDelayMs(attempt: number): number {
  return 80 * attempt;
}

/** Serializable transaction with automatic retry on conflicts and pool/timeout pressure. */
export async function runSerializableTransaction<T>(
  fn: (tx: PrismaTransactionClient) => Promise<T>,
  options: SerializableTransactionOptions = {},
): Promise<T> {
  const { maxAttempts, maxWait, timeout } = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait,
        timeout,
      });
    } catch (error) {
      lastError = error;
      if (isRetryableTransactionError(error) && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

export function isRetryableGameplayConflict(message: string): boolean {
  return (
    message.includes('conflicted with another update') ||
    message.includes('server is busy')
  );
}
