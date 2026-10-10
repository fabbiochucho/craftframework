import { defineConfig, devices } from '@playwright/test'

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000)
const API_PORT = Number(process.env.E2E_API_PORT ?? 8899)
const node = 'node --experimental-transform-types --import ./tests/integration/register.mjs'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
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
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      ...(process.env.E2E_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH } } : {}),
    },
  }],
  webServer: [
    {
      // Real workspace-api handler + real Postgres; test-only sign-in (see apiServer.ts).
      command: `${node} tests/e2e/apiServer.ts`,
      url: `http://127.0.0.1:${API_PORT}/__test/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        TEST_DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        E2E_API_PORT: String(API_PORT),
        E2E_WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // TanStack's preview plugin serves the built SSR fetch handler and static
      // assets. No dev imports/HMR or NetlifyDev's Deno emulation run here.
      command: `npm run build && npx vite preview --host localhost --port ${WEB_PORT} --strictPort`,
      env: { VITE_POSTHOG_KEY: 'e2e-public-project' },
      url: `http://localhost:${WEB_PORT}/code-of-conduct`,
      reuseExistingServer: false,
      timeout: 240_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
