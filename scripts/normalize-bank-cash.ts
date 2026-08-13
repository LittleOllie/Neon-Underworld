#!/usr/bin/env npx tsx
/**
 * One-time maintenance: merge legacy bankCash into cash for all players.
 * Safe to re-run — only touches rows with bankCash > 0.
 *
 * Usage: DATABASE_URL="..." npx tsx scripts/normalize-bank-cash.ts
 */
import { normalizeAllHiddenBankBalances } from '../NeonUnderworld-OldSkool/src/server/services/bank-normalize.service';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const merged = await normalizeAllHiddenBankBalances();
  console.log(`Normalized bankCash for ${merged > 0 ? 'players' : 'no players'} (total $${merged.toLocaleString()} moved to cash).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
