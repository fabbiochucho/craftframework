import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = 3000
const API_PORT = Number(process.env.E2E_API_PORT ?? 8899)
const node = 'node --experimental-transform-types --import ./tests/integration/register.mjs'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // vite dev compiles routes on first visit, so allow generous per-step time.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Keep failures debuggable: traces/screenshots are uploaded by CI on failure.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Real workspace-api handler + real Postgres; test-only sign-in (see apiServer.ts).
      command: `${node} tests/e2e/apiServer.ts`,
      url: `http://127.0.0.1:${API_PORT}/__test/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? '', E2E_API_PORT: String(API_PORT) },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `npm run dev`,
      env: { VITE_POSTHOG_KEY: 'e2e-public-project' },
      url: `http://localhost:${WEB_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
