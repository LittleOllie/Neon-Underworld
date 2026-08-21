import { defineConfig } from '@playwright/test';

const TEST_PORT = process.env.PW_TEST_PORT ? Number(process.env.PW_TEST_PORT) : 3310;
const baseURL = `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL,
  },
  webServer: process.env.E2E_REUSE_SERVER
    ? undefined
    : {
        command: `npm run dev -- -p ${TEST_PORT}`,
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
