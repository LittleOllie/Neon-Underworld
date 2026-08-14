import { execSync } from 'node:child_process';
import path from 'node:path';

export const REPO_ROOT = path.resolve(__dirname, '../..');

export function ensureCartelVerificationFixtures() {
  execSync('npm run db:seed:dev-pvp', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  execSync('npx tsx scripts/e2e-cartel-verification-setup.ts', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
  execSync('npx tsx scripts/e2e-market-seller-setup.ts', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: process.env,
  });
}

export function fundCartelTreasury(cartelName: string, amount: number) {
  execSync(
    `npx tsx scripts/e2e-fund-cartel-treasury.ts --name=${JSON.stringify(cartelName)} --amount=${amount}`,
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: process.env,
    },
  );
}
