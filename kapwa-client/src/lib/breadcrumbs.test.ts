import { describe, it, expect } from 'vitest';
import { createBreadcrumbs, setCaseLabel } from './breadcrumbs';

const CASE_ID = '01a0c9a9-64cc-7063-87ee-6734a8b0e948';

describe('createBreadcrumbs', () => {
  it('labels a case route with its control number once the page registers it', () => {
    setCaseLabel(CASE_ID, 'KAPWA-2026-00001');
    const crumbs = createBreadcrumbs(`/cases/${CASE_ID}`);
    expect(crumbs.map(c => c.label)).toEqual(['Cases', 'KAPWA-2026-00001']);
    expect(crumbs[1].href).toBe(`/cases/${CASE_ID}`);
  });

  it('falls back to a short id when the control number is unknown', () => {
    const other = '01a0c9a9-0000-0000-0000-000000000000';
    const crumbs = createBreadcrumbs(`/cases/${other}`);
    expect(crumbs[1].label).toBe(`Case ${other.slice(0, 8)}`);
  });

  it('keeps the case crumb before sub-page crumbs', () => {
    setCaseLabel(CASE_ID, 'KAPWA-2026-00001');
    const crumbs = createBreadcrumbs(`/cases/${CASE_ID}/payouts`);
    expect(crumbs.map(c => c.label)).toEqual(['Cases', 'KAPWA-2026-00001', 'Payouts']);
    expect(crumbs[2].href).toBe(`/cases/${CASE_ID}/payouts`);
  });
});
