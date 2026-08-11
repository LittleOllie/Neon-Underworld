import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 20_000,
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  });

globalForPrisma.prisma = prisma;

export default prisma;
