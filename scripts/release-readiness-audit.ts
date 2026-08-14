#!/usr/bin/env npx tsx
/**
 * Read-only production release audit. Requires DATABASE_URL in environment.
 * Usage: DATABASE_URL="direct-neon-url" npx tsx scripts/release-readiness-audit.ts
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const root = path.resolve(__dirname, '..');
const prisma = new PrismaClient();

function redactDbUrl(url: string): string {
  return url.replace(/:[^:@]+@/, ':***@');
}

function countRepoMigrations(): { count: number; latest: string } {
  const dir = path.join(root, 'prisma/migrations');
  const folders = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return { count: folders.length, latest: folders[folders.length - 1] ?? 'none' };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const repoMigrations = countRepoMigrations();
  console.log('=== RELEASE READINESS AUDIT (read-only) ===');
  console.log('Database host:', redactDbUrl(dbUrl));
  console.log('Expected repo migrations:', repoMigrations.count);
  console.log('Required latest migration folder:', repoMigrations.latest);

  let migrateOutput = '';
  try {
    migrateOutput = execSync('npx prisma migrate status --schema=prisma/schema.prisma', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    migrateOutput = [err.stdout, err.stderr].filter(Boolean).join('\n');
  }
  console.log('\n--- Prisma migrate status ---');
  console.log(migrateOutput.trim());

  const applied = (await prisma.$queryRaw`
    SELECT COUNT(*)::int AS c FROM _prisma_migrations WHERE rolled_back_at IS NULL
  `) as { c: number }[];
  const latestApplied = (await prisma.$queryRaw`
    SELECT migration_name, finished_at
    FROM _prisma_migrations
    WHERE rolled_back_at IS NULL
    ORDER BY finished_at DESC
    LIMIT 1
  `) as { migration_name: string; finished_at: Date }[];

  console.log('\n--- Migration summary ---');
  console.log('Applied migration count:', applied[0]?.c ?? 0);
  console.log('Latest applied:', latestApplied[0]?.migration_name ?? 'none');
  console.log(
    'Up to date:',
    /Database schema is up to date/i.test(migrateOutput) ? 'YES' : 'NO / REVIEW',
  );

  const bankCount = await prisma.player.count({ where: { bankCash: { gt: 0 } } });
  const bankAgg = await prisma.player.aggregate({
    where: { bankCash: { gt: 0 } },
    _sum: { bankCash: true },
    _max: { bankCash: true },
  });

  console.log('\n--- Legacy bankCash ---');
  console.log('Affected players:', bankCount);
  console.log('Total bankCash:', bankAgg._sum.bankCash ?? 0);
  console.log('Max individual bankCash:', bankAgg._max.bankCash ?? 0);

  const humans = await prisma.player.count({ where: { isSystemPlayer: false } });
  const activeHumans = await prisma.player.count({
    where: { isSystemPlayer: false, lifeStatus: 'ACTIVE' },
  });
  const npcs = await prisma.player.count({ where: { isSystemPlayer: true } });
  const activeNpcs = await prisma.player.count({
    where: { isSystemPlayer: true, lifeStatus: 'ACTIVE' },
  });

  const districts = await prisma.district.findMany({
    select: { id: true, slug: true, name: true },
  });
  const districtMap = Object.fromEntries(districts.map((d) => [d.id, d.slug]));
  const byDistrict = await prisma.player.groupBy({
    by: ['districtId'],
    _count: { _all: true },
    where: { lifeStatus: 'ACTIVE' },
  });

  console.log('\n--- Population ---');
  console.log('Human players (all):', humans);
  console.log('Human players (ACTIVE):', activeHumans);
  console.log('System/NPC players (all):', npcs);
  console.log('System/NPC players (ACTIVE):', activeNpcs);
  console.log('Active players by district:');
  for (const row of byDistrict.sort((a, b) => b._count._all - a._count._all)) {
    console.log(`  ${districtMap[row.districtId] ?? row.districtId}: ${row._count._all}`);
  }

  const invite = await prisma.inviteCode.findFirst({
    where: { label: 'Alpha Access' },
    include: { _count: { select: { uses: true } } },
  });

  console.log('\n--- Invite code (Alpha Access) ---');
  if (!invite) {
    console.log('No Alpha Access invite row found.');
  } else {
    console.log('Active:', invite.active);
    console.log('Maximum uses:', invite.maximumUses ?? 'unlimited');
    console.log('Current uses (counter):', invite.currentUses);
    console.log('Recorded uses (rows):', invite._count.uses);
    console.log(
      'Remaining (if capped):',
      invite.maximumUses != null ? Math.max(0, invite.maximumUses - invite.currentUses) : 'n/a',
    );
  }

  const attackTargets = await prisma.player.count({
    where: {
      lifeStatus: 'ACTIVE',
      isSystemPlayer: false,
      thugs: { gt: 0 },
    },
  });

  console.log('\n--- Attack target availability (approx) ---');
  console.log('Active human players with thugs > 0:', attackTargets);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
