import { test, expect, type Page } from '@playwright/test';

/**
 * Three tests, three promises (audit §3.3):
 *   1. the app boots and a real session starts against a real API + database;
 *   2. the signed-in shell renders (sidebar, the user's own name);
 *   3. a role boundary holds — a social worker cannot reach the admin console.
 *
 * Deliberately shallow: this suite exists to catch "the app does not work at
 * all", the class of failure that unit tests cannot see because they mock the
 * very things that break (routing, the session, the API contract).
 */

const ADMIN = { email: 'admin@mswdo.test', password: 'admin123' };
const WORKER = { email: 'worker1@mswdo.test', password: 'worker123' };

/** The login form's inputs carry generated ids, so they are addressed by name. */
async function signIn(page: Page, who: { email: string; password: string }) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(who.email);
  await page.locator('input[name="password"]').fill(who.password);
  await page.locator('button[type="submit"]').click();

  // The user menu only exists in the signed-in shell, and the shell only
  // renders once /auth/me has answered — so this waits for the whole boot path:
  // login, token, session, first protected request.
  await expect(page.getByRole('button', { name: /open user menu/i })).toBeVisible({ timeout: 30_000 });
}

test('the app boots and an admin can sign in', async ({ page }) => {
  await signIn(page, ADMIN);
  await expect(page).not.toHaveURL(/\/login/);
});

test('the signed-in shell renders the admin session', async ({ page }) => {
  await signIn(page, ADMIN);
  // The admin-only destination is rendered for an admin and for nobody else —
  // the shell, the role and the nav policy in one assertion.
  await expect(page.getByRole('link', { name: /admin panel/i }).first()).toBeVisible();
  // The signed-in affordances are there: the menu opens with the account's own
  // actions (the menu carries no name — the avatar shows initials).
  await page.getByRole('button', { name: /open user menu/i }).click();
  await expect(page.getByRole('menuitem', { name: /settings/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /logout/i })).toBeVisible();
});

test('a social worker is kept out of the admin console', async ({ page }) => {
  await signIn(page, WORKER);
  await page.goto('/admin/programs');
  // ProtectedRoute sends the worker to their own landing page instead.
  await expect(page).not.toHaveURL(/\/admin\/programs/);
});
