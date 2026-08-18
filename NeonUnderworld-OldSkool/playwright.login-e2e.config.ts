import { defineConfig } from '@playwright/test';

const TEST_PORT = 3310;
const baseURL = `http://localhost:${TEST_PORT}`;

/** Login E2E — starts Next directly on 3310 (dev-local.mjs always binds 3302). */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL,
  },
  webServer: {
    command: `npx next dev -p ${TEST_PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: __dirname,
    timeout: 120_000,
    env: {
      ...process.env,
      PLAYTEST_TURNS: 'true',
      NEXT_PUBLIC_PLAYTEST_TURNS: 'true',
    },
  },
});
