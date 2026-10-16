import { defineConfig, devices } from '@playwright/test';

/**
 * Browser-level smoke tests (audit §3.3).
 *
 * Every UI regression of the last month — the navigation blank screen, the
 * inactive-programs filter, the GIS print gate, the court picker — was found by
 * a human driving the app, not by the 1 480 unit tests. These three tests are
 * the cheapest version of that pass: the app boots, a real session starts
 * against a real API and database, and a role boundary holds.
 *
 * The suite expects the API on :3000 (started by CI, or by hand locally) and
 * builds the SPA itself, so it exercises the production bundle rather than the
 * dev server.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // `build:e2e` bakes a RELATIVE api base (`/api/v1`) so the SPA talks to the
    // preview server, which proxies to the API — same origin, no CORS. A plain
    // `npm run build` has no VITE_API_URL, so it falls back to
    // http://localhost:3000 and every request from :4173 is a cross-origin call
    // the API refuses.
    command: 'npm run build:e2e && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
