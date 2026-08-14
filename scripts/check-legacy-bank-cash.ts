/**
 * Read-only diagnostic: reports players with legacy bankCash balances.
 * Does NOT mutate data.
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/check-legacy-bank-cash.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const affected = await prisma.player.count({ where: { bankCash: { gt: 0 } } });
  const agg = await prisma.player.aggregate({
    where: { bankCash: { gt: 0 } },
    _sum: { bankCash: true },
    _max: { bankCash: true },
  });

  console.log('=== Legacy bankCash diagnostic (read-only) ===');
  console.log('Players with bankCash > 0:', affected);
  console.log('Total bankCash:', agg._sum.bankCash ?? 0);
  console.log('Max individual bankCash:', agg._max.bankCash ?? 0);

  if (affected > 0) {
    console.log('\nOne-time cleanup (operator only, idempotent):');
    console.log('  DATABASE_URL="direct-url" npx tsx scripts/normalize-bank-cash.ts');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
