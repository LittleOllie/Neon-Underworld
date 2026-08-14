import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../../..');

describe('env and secret hygiene', () => {
  it('.env is gitignored', () => {
    const gitignore = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^\.env/m);
  });

  it('.env.example has placeholders only, not live secrets', () => {
    const example = readFileSync(path.join(root, '.env.example'), 'utf8');
    expect(example).not.toMatch(/AUTH_SECRET="[a-zA-Z0-9+/=]{20,}"/);
    expect(example).toMatch(/AUTH_SECRET=/);
  });

  it('client playtest config does not read server-only PLAYTEST_TURNS', () => {
    const playtest = readFileSync(path.join(root, 'src/config/game/playtest.ts'), 'utf8');
    expect(playtest).toMatch(/isPlaytestTurnsNavVisible[\s\S]*NEXT_PUBLIC_PLAYTEST_TURNS/);
    expect(playtest).not.toMatch(/isPlaytestTurnsNavVisible[\s\S]*process\.env\.PLAYTEST_TURNS/);
  });

  it('playtest flags are documented as dev-only in deployment docs', () => {
    const deployment = readFileSync(path.join(root, 'docs/DEPLOYMENT.md'), 'utf8');
    expect(deployment).toMatch(/rejects.*true/i);
    expect(deployment).toMatch(/Rotate admin password/i);
  });
});
