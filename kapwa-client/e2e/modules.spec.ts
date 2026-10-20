import { test, expect, type Page } from '@playwright/test';

/**
 * Every module, once, in a real browser against a real API (audit §3.3).
 *
 * smoke.spec.ts proves the app boots and one role boundary holds; this suite
 * walks the rest of the shell so a module that stops rendering is caught here
 * instead of by a human on demo day. One test per role, one step per module: a
 * failure names the module in its step list.
 *
 * It signs in once per role on purpose — /auth/login is throttled to 10/min, so
 * a sign-in per route starts failing part-way through the run.
 *
 * Detail pages are reached the way an operator reaches them: by clicking the
 * first row action on the list that owns them. A module with no rows in the
 * database is logged as empty rather than failed — that list is what the demo
 * seed exists to fill.
 */

const ACCOUNTS = {
  admin: { email: 'admin@mswdo.test', password: 'admin123' },
  coordinator: { email: 'coordinator.bangkal@mswdo.test', password: 'coordinator123' },
  claimant: { email: 'pedro.claimant@test.com', password: 'claimant123' },
} as const;

/** The login form's inputs carry generated ids, so they are addressed by name. */
async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(who.email);
  await page.locator('input[name="password"]').fill(who.password);
  await page.locator('button[type="submit"]').click();
  await expect(page.getByRole('button', { name: /open user menu/i })).toBeVisible({ timeout: 30_000 });
}

/** Renders a route and reports what went wrong with it, empty when fine. */
async function audit(page: Page, path: string): Promise<string[]> {
  const problems: string[] = [];
  const onCrash = (e: Error) => problems.push(`uncaught: ${e.message}`);
  page.on('pageerror', onCrash);
  try {
    await page.goto(path);
    // The requested route, not a redirect away from it.
    const wanted = new URL(path, page.url()).pathname;
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30_000 }).toBe(wanted);
    // Every module page renders through PageShell, whose title is the one h1.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    // The boundary renders in place of a crashed subtree.
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  } catch (e) {
    problems.push(e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    page.off('pageerror', onCrash);
  }
  return problems;
}

/**
 * Opens the first row of a list page and returns where it landed, or null when
 * the list has nothing to open. Row navigation is a button, not a link, so the
 * button is clicked; "New"/"Add"/filter buttons are not row actions.
 */
async function openFirstRow(page: Page, listPath: string): Promise<string | null> {
  await page.goto(listPath);
  await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
  // The rows arrive with the list request; without them this would report the
  // module empty just because it was still loading.
  await page
    .locator(`main a[href^="${listPath}/"], table tbody tr`)
    .first()
    .waitFor({ timeout: 8_000 })
    .catch(() => undefined);

  const rowLink = page.locator(`main a[href^="${listPath}/"]`).first();
  const rowButton = page.locator('table tbody tr').first().getByRole('button').first();
  // Card lists open with a full-width button named "Open <title>". Scoped to
  // `main`: the shell's own "Open user menu" is a button too, and it comes first.
  const content = page.locator('main');
  const openAction = content.getByRole('button', { name: /^open\b/i }).first();
  const anyAction = content
    .getByRole('button')
    .filter({ hasNotText: /new|add|create|filter|export|search|refresh|cancel|back|dismiss|user menu/i })
    .first();

  for (const candidate of [rowLink, rowButton, openAction, anyAction]) {
    if ((await candidate.count()) === 0) continue;
    const before = page.url();
    await candidate.click({ timeout: 5_000 }).catch(() => undefined);
    // Wait for the navigation instead of guessing how long it takes.
    await expect.poll(() => page.url(), { timeout: 8_000 }).not.toBe(before).catch(() => undefined);
    if (page.url() !== before) return page.url();
  }
  return null;
}

const MODULE_ROUTES: Array<[string, string]> = [
  ['/dashboard', 'dashboard'],
  ['/intake', 'intake wizard'],
  ['/intake/review', 'intake review'],
  ['/intake/referrals', 'intake referrals'],
  ['/cases', 'cases'],
  ['/beneficiaries', 'beneficiaries'],
  ['/client-dedup', 'client dedup operations'],
  ['/client-dedup/new', 'client dedup — new run'],
  ['/tracker', 'case tracker'],
  ['/approvals', 'approval pipeline'],
  ['/admin', 'admin panel'],
  ['/admin/users', 'users'],
  ['/admin/users/new', 'new user'],
  ['/admin/programs', 'programs'],
  ['/admin/programs/new', 'new program'],
  ['/settings', 'settings'],
  ['/team', 'team workspace'],
  ['/referrals', 'referrals'],
  ['/messages', 'messages'],
  ['/search?q=reyes', 'search'],
  ['/notifications', 'notifications'],
  ['/announcements/manage', 'announcements'],
  ['/announcements/manage/new', 'new announcement'],
];

// A full walk of one role's shell: 23 routes plus the pages behind them. The
// config's 60 s default is for the smoke tests, not for this.
test.setTimeout(240_000);

test('every admin module renders, and its detail pages open', async ({ page }) => {
  await signIn(page, ACCOUNTS.admin);
  const problems: string[] = [];
  const empty: string[] = [];
  const auditStep = async (label: string, path: string) => {
    for (const p of await audit(page, path)) problems.push(`${label} (${path}) — ${p}`);
  };

  for (const [path, label] of MODULE_ROUTES) await test.step(label, () => auditStep(label, path));

  const openDetail = async (label: string, list: string, path?: (url: string) => string) => {
    await test.step(label, async () => {
      const url = await openFirstRow(page, list);
      if (!url) return empty.push(label);
      await auditStep(label, path ? path(url) : url);
    });
  };

  await openDetail('case detail', '/cases');
  await openDetail('beneficiary detail', '/beneficiaries');
  await openDetail('program detail', '/admin/programs');
  await openDetail('dedup operation review', '/client-dedup');
  await openDetail('announcement detail', '/announcements/manage');
  await openDetail('4Ps compliance', '/cases', (u) => `${u}/4ps-compliance`);
  await openDetail('payout schedule', '/cases', (u) => `${u}/payouts`);
  await openDetail('new IRF', '/cases', (u) => `/irf/new?caseId=${u.split('/').pop()}`);

  await test.step('dedup match panel loads', async () => {
    // The row-matches panel calls its own endpoint; opening the review page does
    // not request it, which is how a 500 there slipped past this suite once.
    const href = await openFirstRow(page, '/client-dedup');
    if (!href) return empty.push('dedup match panel');
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
    const panel = page.getByRole('button', { name: /review matches/i }).first();
    if (!(await panel.count())) return empty.push('dedup match panel');
    const failures: string[] = [];
    const onResponse = (r: { url: () => string; status: () => number }) => {
      const url = r.url();
      if (url.includes('/matches') && r.status() >= 400) failures.push(`${r.status()} ${url}`);
    };
    page.on('response', onResponse);
    await panel.click();
    await page.waitForTimeout(1_500);
    page.off('response', onResponse);
    if (failures.length) problems.push(`dedup matches — ${failures.join(', ')}`);
  });

  await test.step('beneficiary list filters', async () => {
    await page.goto('/beneficiaries');
    await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });
    const search = page.getByPlaceholder(/search/i).first();
    if ((await search.count()) === 0) return empty.push('beneficiary search input');
    await search.fill('zzz-no-such-client');
    await page.getByRole('button', { name: /^search$/i }).first().click().catch(() => undefined);
    const settled = page.getByText(/no .*(found|results|clients|beneficiar)/i).first();
    await settled.waitFor({ timeout: 15_000 }).catch(() => problems.push('beneficiary list — search never settles on an empty state'));
  });

  await test.step('case tracker filters', async () => {
    await page.goto('/tracker');
    await expect(page.getByRole('group', { name: /filter by status/i })).toBeVisible({ timeout: 15_000 }).catch(() =>
      problems.push('case tracker — no status filter'),
    );
  });

  await test.step('dedup define form', async () => {
    await page.goto('/client-dedup/new');
    await expect(page.getByText(/last name|surname/i).first()).toBeVisible({ timeout: 30_000 }).catch(() =>
      problems.push('dedup new run — no column map'),
    );
  });

  if (empty.length) console.log(`[empty modules] ${empty.join(', ')}`);
  expect(problems, `modules that did not render:\n${problems.join('\n')}`).toEqual([]);
});

test('every coordinator module renders, and the admin console stays closed', async ({ page }) => {
  await signIn(page, ACCOUNTS.coordinator);
  const problems: string[] = [];

  for (const path of ['/coordinator/dashboard', '/coordinator/referrals', '/coordinator/referrals/new', '/coordinator/tracker', '/coordinator/access-cards', '/team', '/messages']) {
    await test.step(path, async () => {
      for (const p of await audit(page, path)) problems.push(`${path} — ${p}`);
    });
  }

  await test.step('referral detail', async () => {
    const url = await openFirstRow(page, '/coordinator/referrals');
    if (!url) return;
    for (const p of await audit(page, url)) problems.push(`referral detail (${url}) — ${p}`);
  });

  await test.step('the admin console is not reachable', async () => {
    await page.goto('/admin');
    // The guard redirects once the session resolves, so the URL is retried.
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 15_000 }).catch(() =>
      problems.push(`role boundary — coordinator stayed on ${page.url()}`),
    );
  });

  expect(problems, `coordinator modules that did not render:\n${problems.join('\n')}`).toEqual([]);
});

test('every claimant module renders, and the case files stay closed', async ({ page }) => {
  await signIn(page, ACCOUNTS.claimant);
  const problems: string[] = [];

  for (const path of ['/my-dashboard', '/my-access-card', '/messages', '/notifications', '/search?q=reyes']) {
    await test.step(path, async () => {
      for (const p of await audit(page, path)) problems.push(`${path} — ${p}`);
    });
  }

  await test.step('the case files are not reachable', async () => {
    await page.goto('/cases');
    await expect(page).not.toHaveURL(/\/cases/, { timeout: 15_000 }).catch(async () =>
      problems.push(
        `role boundary — claimant stayed on ${page.url()} (h1: ${await page.locator('h1').first().textContent().catch(() => 'none')}, verifying: ${await page.getByText(/verifying access/i).count()})`,
      ),
    );
  });

  expect(problems, `claimant modules that did not render:\n${problems.join('\n')}`).toEqual([]);
});
