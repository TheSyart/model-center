import { defineConfig } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '3100';
const databaseDir = process.env.PLAYWRIGHT_DB_DIR ?? '.next-playwright-data';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-375', use: { viewport: { width: 375, height: 812 } } },
    { name: 'tablet-768', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: 'node tests/mock-anthropic.mjs 4001',
      url: 'http://127.0.0.1:4001/v1/models',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `MODEL_CENTER_DB_DIR=${databaseDir} node --experimental-strip-types tests/raw-capture-e2e-seed.ts && MODEL_CENTER_DB_DIR=${databaseDir} MODEL_CENTER_NEXT_DIST_DIR=${databaseDir}/next-dist MODEL_CENTER_NEXT_TSCONFIG=.next-playwright-data/tsconfig.json npm run dev -- --hostname 127.0.0.1 --port ${port}`,
      url: `http://127.0.0.1:${port}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
