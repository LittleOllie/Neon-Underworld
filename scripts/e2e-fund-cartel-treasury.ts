/**
 * Funds a cartel treasury for E2E armoury purchases (test infrastructure only).
 */
import { PrismaClient } from '@prisma/client';
import { assertDevSeedAllowed } from './lib/dev-guard';

const prisma = new PrismaClient();

async function main() {
  assertDevSeedAllowed('e2e-fund-cartel-treasury');
  const nameArg = process.argv.find((a) => a.startsWith('--name='))?.slice('--name='.length);
  const amountArg = process.argv.find((a) => a.startsWith('--amount='))?.slice('--amount='.length);
  if (!nameArg || !amountArg) {
    console.error('Usage: --name=CartelName --amount=50000');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEV_PVP_SEED !== 'true') {
    console.error('Refusing treasury fund in production.');
    process.exit(1);
  }

  const amount = parseInt(amountArg, 10);
  const cartel = await prisma.cartel.findFirst({ where: { name: nameArg } });
  if (!cartel) {
    console.error(`Cartel not found: ${nameArg}`);
    process.exit(1);
  }

  await prisma.cartel.update({
    where: { id: cartel.id },
    data: { treasuryCash: amount },
  });
  console.log(`Funded ${nameArg} treasury to $${amount.toLocaleString()}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
