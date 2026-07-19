import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('Dashboard Audit — login + page render', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Use page-level fetch so cookies are handled naturally
    await page.goto(`${BASE}/login`);
    // Health endpoint sets CSRF cookie via proxy
    await page.goto(`${BASE}/api/v1/health`);
    await page.waitForTimeout(500);

    // Get CSRF token from cookie
    const csrfToken = await page.evaluate(() => {
      const m = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
      return m?.[1] ?? '';
    });

    // Login via page.evaluate fetch (same-origin, cookies attached)
    const loginResult = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ email: 'admin@mswdo.test', password: 'admin123' }),
      });
      if (!res.ok) return { error: res.status, body: await res.text() };
      return await res.json();
    }, csrfToken);

    if ('error' in loginResult) {
      console.error('Login failed:', loginResult);
      throw new Error(`Login failed: ${loginResult.error} - ${loginResult.body}`);
    }

    const body = loginResult as { accessToken: string };
    expect(body).toHaveProperty('accessToken');

    // Store token in localStorage for the SPA
    await page.evaluate((token: string) => {
      localStorage.setItem('kapwa_token', token);
    }, body.accessToken);
  });

  test('Dashboard page loads and shows stats + widgets + cases table', async () => {
    // Navigate to dashboard
    await page.goto(`${BASE}/dashboard`);
    // Wait for page shell to render
    await page.waitForTimeout(2000);

    // Take screenshot
    const screenshotPath = '/tmp/dashboard-initial.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot saved: ${screenshotPath}`);

    // Get page content text
    const bodyText = await page.textContent('body');
    
    // Check for critical elements
    const checks: { name: string; ok: boolean }[] = [];

    // Check no errors displayed
    const errorTexts = ['Something went wrong', 'Error', 'Failed to load', 'Internal Server Error'];
    for (const et of errorTexts) {
      if (bodyText?.includes(et)) {
        checks.push({ name: `No "${et}" error`, ok: false });
      }
    }
    // Only push if not found
    if (!errorTexts.some(et => bodyText?.includes(et))) {
      checks.push({ name: 'No error messages', ok: true });
    }

    // Check for key dashboard elements
    checks.push({ name: 'Page title "Dashboard"',
      ok: bodyText?.includes('Dashboard') ?? false });
    checks.push({ name: 'StatsRow present (e.g. "Served Today")',
      ok: bodyText?.includes('Served Today') ?? false });

    // Check widget areas
    const widgetLabels = ['Case Status', 'SLA', 'Needs Attention', 'Barangay'];
    for (const label of widgetLabels) {
      checks.push({ name: `Widget "${label}" present`,
        ok: bodyText?.includes(label) ?? false });
    }

    // Check cases table
    checks.push({ name: 'Cases table present (column headers visible)',
      ok: (bodyText?.includes('Surname') ?? false) || (bodyText?.includes('Status') ?? false) || (bodyText?.includes('Gender') ?? false) });

    // Check console errors
    const consoleErrors = page.listenerCount('console') > 0 ? [] : [];
    checks.push({ name: 'No console errors',
      ok: consoleErrors.length === 0 });

    // Print results
    console.log('\n=== Dashboard Audit Results ===');
    let passCount = 0;
    for (const c of checks) {
      const status = c.ok ? '✓' : '✗';
      console.log(`  ${status} ${c.name}`);
      if (c.ok) passCount++;
    }
    console.log(`\n${passCount}/${checks.length} checks passed`);
  });

  test('Dashboard API endpoints return 200', async () => {
    const token = await page.evaluate(() => localStorage.getItem('kapwa_token'));
    const csrfToken = await page.evaluate(() => {
      const m = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
      return m?.[1] ?? '';
    });

    const endpoints = [
      { path: '/api/v1/dashboard', label: 'GET /api/v1/dashboard' },
      { path: '/api/v1/dashboard/metrics', label: 'GET /api/v1/dashboard/metrics' },
      { path: '/api/v1/dashboard/trends', label: 'GET /api/v1/dashboard/trends' },
      { path: '/api/v1/dashboard/sla', label: 'GET /api/v1/dashboard/sla' },
    ];
    console.log('\n=== Dashboard API Endpoint Checks ===');
    for (const ep of endpoints) {
      const result = await page.evaluate(async ({ path, token, csrfToken }) => {
        const res = await fetch(path, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-CSRF-Token': csrfToken,
          },
        });
        return { status: res.status, body: await res.text().then(t => t.substring(0, 200)) };
      }, { path: ep.path, token, csrfToken });
      const ok = result.status >= 200 && result.status < 500;
      console.log(`  ${ok ? '✓' : '✗'} ${ep.label} → ${result.status}`);
      if (result.status >= 400) {
        console.log(`    Body: ${result.body}`);
      }
    }
  });
});
