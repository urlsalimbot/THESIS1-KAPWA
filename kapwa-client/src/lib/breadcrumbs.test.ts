import { describe, it, expect } from 'vitest';
import { createBreadcrumbs, setCaseLabel, setBreadcrumbLabel } from './breadcrumbs';

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

  it('names an unregistered UUID crumb after its route, not always "Case"', () => {
    const benId = '01a0cdc7-8600-7558-a79e-2806b67803db';
    expect(createBreadcrumbs(`/beneficiaries/${benId}`).map(c => c.label))
      .toEqual(['Beneficiaries', `Beneficiary ${benId.slice(0, 8)}`]);

    const irfId = '01a0cdd8-6307-75bd-b6dc-0c941e2f001c';
    expect(createBreadcrumbs(`/irf/${irfId}`).map(c => c.label))
      .toEqual(['Incident Reports', `Incident Report ${irfId.slice(0, 8)}`]);

    expect(createBreadcrumbs(`/beneficiary/${benId}/access-card`).map(c => c.label))
      .toEqual(['Beneficiary', 'Access Card 01a0cdc7', 'Access Card']);
  });

  it('uses a registered label for any UUID-deep route', () => {
    const benId = '01a0cdc7-8600-7558-a79e-2806b67803db';
    setBreadcrumbLabel(benId, 'Salvador, Elena');
    expect(createBreadcrumbs(`/beneficiaries/${benId}`).map(c => c.label))
      .toEqual(['Beneficiaries', 'Salvador, Elena']);

    const irfId = '01a0cdd8-6307-75bd-b6dc-0c941e2f001c';
    setBreadcrumbLabel(irfId, 'BLT-2026-0001');
    expect(createBreadcrumbs(`/irf/${irfId}`).map(c => c.label))
      .toEqual(['Incident Reports', 'BLT-2026-0001']);
  });
});
