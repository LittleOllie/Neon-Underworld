import { execSync } from 'node:child_process';
import path from 'node:path';

/**
 * Ensures dev PvP buyer (RustRunner) exists for two-account market E2E.
 * Safe for test DB only — refuses production unless ALLOW_DEV_PVP_SEED=true.
 */
export function ensurePass4E2EFixtures() {
  execSync('npx tsx scripts/seed-dev-pvp-opponents.ts', {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: process.env,
  });
}
