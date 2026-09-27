import { NAV_GROUPS } from './nav-config';

describe('feature toggles', () => {
  it('hides Analytics from the nav by default (toggle off)', () => {
    const labels = NAV_GROUPS.map((g) => g.label);
    expect(labels).not.toContain('Insights');
  });
});