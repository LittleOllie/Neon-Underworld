/**
 * Start Next dev using NeonUnderworld-OldSkool/.env — overrides any shell DATABASE_URL
 * (e.g. from Vercel CLI) so local dev always hits localhost Postgres.
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(root, '.env');

function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    console.warn(`[dev-local] No .env at ${path}`);
    return;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(envPath);

const db = process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@') ?? '(missing)';
console.log(`[dev-local] DATABASE_URL=${db}`);

const portFromArgs = (() => {
  const idx = process.argv.indexOf('-p');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.PORT ?? '3302';
})();

const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'dev', '-p', portFromArgs],
  {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
