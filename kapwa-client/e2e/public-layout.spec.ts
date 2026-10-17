import { test, expect } from '@playwright/test';

/**
 * The public carousel bleeds into the page gutter so its cards keep a symmetric
 * inset on both sides, and `scroll-padding` keeps snapping on the same line as
 * the rest of the page. Both are pure layout behaviour: no unit test can see
 * them, and both regress silently if the scroll container's classes change.
 *
 * Hermetic — the two public endpoints the landing page reads are stubbed, so
 * this does not depend on database contents.
 */
const PROGRAMS = Array.from({ length: 6 }, (_, i) => ({
  id: `stub-${i}`,
  name: `Stub program ${i + 1}`,
  category: 'Medical',
  processingTime: '3 days',
  description: 'Stub description for the carousel layout test.',
  fundSources: [],
  requiredDocuments: [],
}));

interface Geometry {
  scrollerX: number;
  cardX: number | null;
  inset: number | null;
  h1X: number;
  overflow: boolean;
  padLeft: string;
  scrollPadLeft: string;
}

test('carousel cards stay on the page rhythm at rest and after snapping', async ({ page }) => {
  await page.route('**/api/v1/programs/public', (route) => route.fulfill({ json: PROGRAMS }));
  await page.route('**/api/v1/announcements/public', (route) => route.fulfill({ json: [] }));

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('div.snap-x').first()).toBeVisible();

  const geometry = (): Geometry | null => {
    const s = document.querySelector('div.snap-x');
    const h1 = document.querySelector('h1');
    if (!s || !h1) return null;
    const cs = getComputedStyle(s);
    const sb = s.getBoundingClientRect();
    // the leftmost card fully inside the scrollport, i.e. what the eye reads as
    // "first card" once snap-mandatory has settled
    const first = [...s.children].find((c) => c.getBoundingClientRect().x >= sb.x - 1);
    const cardX = first ? Math.round(first.getBoundingClientRect().x) : null;
    return {
      scrollerX: Math.round(sb.x),
      cardX,
      inset: cardX === null ? null : cardX - Math.round(sb.x),
      h1X: Math.round(h1.getBoundingClientRect().x),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      padLeft: cs.paddingLeft,
      scrollPadLeft: cs.scrollPaddingLeft,
    };
  };

  const rest = await page.evaluate(geometry);
  expect(rest, 'no snap scroller on the landing page').not.toBeNull();
  const restMsg = `at rest: ${JSON.stringify(rest)}`;

  // Cards start on the same line as the page heading rather than flush against
  // the scroll container's edge, and the bleed adds no horizontal overflow.
  expect(rest!.cardX, restMsg).toBe(rest!.h1X);
  expect(rest!.inset, restMsg).toBeGreaterThan(0);
  expect(rest!.overflow, restMsg).toBe(false);

  await page.getByRole('button', { name: /next programs/i }).click();
  await page.waitForTimeout(1000);

  const afterSnap = await page.evaluate(geometry);
  const snapMsg = `after snapping: ${JSON.stringify(afterSnap)}`;

  // scroll-padding keeps the snapped card on the page rhythm; without it the
  // card lands on the scroll container's padding-box edge instead.
  expect(afterSnap!.cardX, snapMsg).toBe(afterSnap!.h1X);
});

/**
 * The OTP / 2FA card header is a state a real session cannot reach, so a
 * regression there (an icon tile stacked back above the heading) would go
 * unnoticed. Forced here by stubbing the login response.
 */
test('the OTP header keeps its icon inline rather than in a tile above', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({ json: { mfaRequired: true, tempToken: 'stub', mfaMethod: 'totp' } }),
  );

  await page.goto('/login');
  await page.fill('input[name="email"]', 'someone@example.com');
  await page.fill('input[name="password"]', 'secret123');
  await page.click('button[type="submit"]');

  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toContainText('Two-Factor Authentication');

  // one inline icon inside the heading, aria-hidden
  await expect(heading.locator('svg[aria-hidden="true"]')).toHaveCount(1);

  // nothing accent-tiled sits above the heading *inside the card* (the auth
  // shell's own brand mark above the card is expected and excluded)
  const tilesAbove = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (!h1) return ['no h1'];
    const card = h1.closest('div.rounded-lg.border') || h1.parentElement;
    if (!card) return ['no card'];
    const top = h1.getBoundingClientRect().top;
    return [...card.querySelectorAll('*')]
      .filter(
        (el) =>
          String(el.className).includes('bg-accent/10') &&
          el.getBoundingClientRect().height > 0 &&
          el.getBoundingClientRect().bottom <= top + 1,
      )
      .map((el) => String(el.className).slice(0, 60));
  });
  expect(tilesAbove, `accent tile(s) stacked above the heading: ${tilesAbove.join(' | ')}`).toEqual([]);
});
