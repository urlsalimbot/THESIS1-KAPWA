import { describe, it, expect, vi, afterEach } from 'vitest';
import { NAV_GROUPS } from './nav-config';

describe('feature toggles', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('shows Analytics in the nav by default', () => {
    expect(NAV_GROUPS.map((g) => g.label)).toContain('Insights');
  });

  it('offers Analytics to staff roles only (not coordinators)', () => {
    const insights = NAV_GROUPS.find((g) => g.label === 'Insights');
    const analytics = insights?.items.find((i) => i.path === '/analytics');
    expect(analytics?.roles).toEqual(['admin', 'social_worker']);
  });

  it('hides Analytics when the build opts out', async () => {
    vi.stubEnv('VITE_ENABLE_ANALYTICS', 'false');
    vi.resetModules();
    const { NAV_GROUPS: toggledOff } = await import('./nav-config');
    expect(toggledOff.map((g) => g.label)).not.toContain('Insights');
  });
});

describe('Team Workspace nav item', () => {
  const core = NAV_GROUPS.find((g) => g.label === 'Core');
  const team = core?.items.find((i) => i.path === '/team');

  it('sits under the Core group', () => {
    expect(core).toBeDefined();
    expect(team).toBeDefined();
  });

  it('is labelled "Team Workspace"', () => {
    expect(team?.label).toBe('Team Workspace');
  });

  it('is offered to admin, social_worker and coordinator', () => {
    expect(team?.roles).toEqual(['admin', 'social_worker', 'coordinator']);
  });

  it.each(['admin', 'social_worker', 'coordinator'])('is visible for %s', (role) => {
    const visible = NAV_GROUPS.some((g) =>
      g.items.some((i) => i.path === '/team' && i.roles.includes(role)),
    );
    expect(visible).toBe(true);
  });

  it.each(['claimant', 'mayor', 'auditor', 'agency_staff'])('is hidden for %s', (role) => {
    const visible = NAV_GROUPS.some((g) =>
      g.items.some((i) => i.path === '/team' && i.roles.includes(role)),
    );
    expect(visible).toBe(false);
  });
});

describe('Team Workspace route', () => {
  it('registers a /team route guarded for admin, social_worker and coordinator', async () => {
    // Lazy import keeps routes.tsx (and its heavy provider graph) out of the
    // other nav tests; the router is created at module load, so the import
    // itself proves the config builds.
    const { router } = await import('@/routes');
    await router.navigate('/team');
    const match = router.state.matches.find((m) => m.route.path === '/team');
    expect(match).toBeDefined();
    const element = (match?.route as unknown as {
      element?: { props?: { roles?: string[] } };
    })?.element;
    expect(element?.props?.roles).toEqual(['admin', 'social_worker', 'coordinator']);
    expect(router.state.location.pathname).toBe('/team');
  });
});

describe('Analytics route', () => {
  it('registers /analytics for staff (admin + social_worker) by default', async () => {
    const { router } = await import('@/routes');
    await router.navigate('/analytics');
    const match = router.state.matches.find((m) => m.route.path === '/analytics');
    expect(match).toBeDefined();
    const element = (match?.route as unknown as {
      element?: { props?: { roles?: string[] } };
    })?.element;
    expect(element?.props?.roles).toEqual(['admin', 'social_worker']);
  });
});