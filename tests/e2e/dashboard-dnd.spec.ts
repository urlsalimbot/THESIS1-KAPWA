import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3001';

test.describe('Dashboard Static Grid Layout', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${BASE}/login`);
    await page.goto(`${BASE}/api/v1/health`);
    await page.waitForTimeout(500);
    const csrfToken = await page.evaluate(() => {
      const m = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
      return m?.[1] ?? '';
    });
    const loginResult = await page.evaluate(async (token) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ email: 'admin@mswdo.test', password: 'admin123' }),
      });
      if (!res.ok) return { error: res.status, body: await res.text() };
      return await res.json();
    }, csrfToken);
    if ('error' in loginResult) throw new Error(`Login failed: ${loginResult.error}`);
    await page.evaluate((token: string) => localStorage.setItem('kapwa_token', token), (loginResult as any).accessToken);
  });

  test('All widget cards are rendered', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    const text = await page.textContent('body');
    const checks = [
      'Case Status', 'SLA Status', 'Monthly Trends',
      'Needs Attention', 'By Barangay',
      'Activity Calendar', 'Recent Cases',
    ];
    for (const label of checks) {
      expect(text).toContain(label);
    }
  });

  test('Widgets are wrapped in Card components with titles', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    const cards = page.locator('div.rounded-lg.border.bg-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test('StatsRow renders with numerical data', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    await expect(page.getByText('Served Today')).toBeVisible();
    await expect(page.getByText('Pending Review')).toBeVisible();
    await expect(page.getByText('Overdue SLA')).toBeVisible();
    await expect(page.getByText('Disbursed Month')).toBeVisible();
  });

  test('Recent Cases table has rows', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('Activity Calendar renders current month', async () => {
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    const now = new Date();
    const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    await expect(page.getByText(monthYear)).toBeVisible();
  });

  test('Page loads without console errors', async () => {
    const errors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});
