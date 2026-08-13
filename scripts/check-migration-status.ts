#!/usr/bin/env npx tsx
/**
 * Verify production/staging DB has all Prisma migrations applied.
 * Usage: DATABASE_URL="direct-neon-url" npx tsx scripts/check-migration-status.ts
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  console.log('Checking migration status against', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':***@'));

  try {
    const output = execSync('npx prisma migrate status --schema=prisma/schema.prisma', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log(output);
    if (/Database schema is up to date/i.test(output)) {
      console.log('\n✓ Migrations match schema.');
      process.exit(0);
    }
    if (/Following migration/i.test(output)) {
      console.error('\n✗ Pending migrations — run: npx prisma migrate deploy');
      process.exit(1);
    }
    console.log('\n? Review output above.');
    process.exit(0);
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; status?: number };
    if (err.stdout) console.log(err.stdout);
    if (err.stderr) console.error(err.stderr);
    process.exit(err.status ?? 1);
  }
}

main();
