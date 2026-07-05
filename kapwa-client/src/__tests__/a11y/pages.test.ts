import { describe, test, expect } from 'vitest';

/*
 * Playwright-based page-level axe-core audits.
 * These tests require both the frontend dev server (port 3001)
 * and backend API (port 3000) to be running.
 *
 * Run manually: npx playwright test src/tests/a11y/pages.test.ts
 * All tests are skipped by default since backend is not available.
 */

let AxeBuilder: any;
let chromium: any;

try {
  const axeModule = await import('@axe-core/playwright');
  AxeBuilder = axeModule.default;
  const pw = await import('playwright');
  chromium = pw.chromium;
} catch {
  // Playwright not available — all tests skip
}

import { AXE_TAGS, DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from './axe-setup';

const BASE_URL = 'http://localhost:3001';

const pages = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Cases', path: '/cases' },
  { name: 'Intake', path: '/intake' },
  { name: 'Beneficiaries', path: '/beneficiaries' },
  { name: 'Approvals', path: '/approvals' },
];

const runTest = chromium ? test : test.skip;

describe('Page-level axe-core audits', () => {
  pages.forEach(({ name, path }) => {
    runTest(`${name} page has no a11y violations`, async () => {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });

      const builder = new AxeBuilder()
        .withTags(AXE_TAGS)
        .include(DEFAULT_INCLUDE)
        .exclude(DEFAULT_EXCLUDE);

      const results = await builder.analyze();

      expect(results.violations).toHaveLength(0);

      await browser.close();
    }, 30000);
  });
});
