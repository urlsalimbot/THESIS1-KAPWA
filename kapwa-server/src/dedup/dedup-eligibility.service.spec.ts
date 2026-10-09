import { computeEligibility, EligibilityRowInput } from './dedup-eligibility.service';

const TODAY = '2026-10-09';
const row = (rowIndex: number, r: Partial<EligibilityRowInput> = {}): EligibilityRowInput => ({
  rowIndex, ...r,
});
const recent = (daysAgo: number, type = 'food_pack'): { deliveryDate: string; type: string | null } => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return { deliveryDate: d.toISOString().slice(0, 10), type };
};

describe('computeEligibility', () => {
  it('allows a client with no intervention history even with a person match', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [row(2, { personId: 'p1' })],
      interventionsByPerson: {},
    });
    expect(out[2]).toEqual({ eligibility: 'allowed', reason: '' });
  });

  it('allows a client whose latest intervention is more than 30 days old', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [row(2, { personId: 'p1' })],
      interventionsByPerson: { p1: [recent(45), recent(60)] },
    });
    expect(out[2].eligibility).toBe('allowed');
  });

  it('disqualifies a client with an intervention within 30 days (boundary 30 = disqualified)', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [row(2, { personId: 'p1' })],
      interventionsByPerson: { p1: [recent(30)] },
    });
    expect(out[2]).toMatchObject({ eligibility: 'disqualified' });
    expect(out[2].reason).toContain('within the last 30 days');
    expect(out[2].reason).toContain('food_pack');
  });

  it('disqualifies when another household member was served within 30 days', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [row(2, { personId: 'p1', householdId: 'h1', householdPersonIds: ['p1', 'p2'] })],
      interventionsByPerson: { p1: [recent(60)], p2: [recent(10, 'medical_assistance')] },
    });
    expect(out[2]).toMatchObject({ eligibility: 'disqualified' });
    expect(out[2].reason).toContain('household member');
  });

  it('does not disqualify on the member whose own service is the old one', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [row(2, { personId: 'p1', householdId: 'h1', householdPersonIds: ['p1', 'p2'] })],
      interventionsByPerson: { p1: [recent(60)], p2: [] },
    });
    expect(out[2].eligibility).toBe('allowed');
  });

  it('lets exactly one row through when the same person applies twice in one list', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [row(3, { personId: 'p1' }), row(9, { personId: 'p1' })],
      interventionsByPerson: {},
    });
    expect(out[3].eligibility).toBe('allowed');
    expect(out[9]).toMatchObject({ eligibility: 'disqualified' });
    expect(out[9].reason).toContain('Row 3');
  });

  it('lets exactly one row through per household when members co-apply', () => {
    const out = computeEligibility({
      today: TODAY,
      rows: [
        row(4, { personId: 'p1', householdId: 'h1', householdPersonIds: ['p1', 'p2'] }),
        row(11, { personId: 'p2', householdId: 'h1', householdPersonIds: ['p1', 'p2'] }),
        row(20, { personId: 'p3', householdId: 'h2', householdPersonIds: ['p3'] }),
      ],
      interventionsByPerson: { p1: [recent(90)], p2: [recent(90)], p3: [recent(90)] },
    });
    expect(out[4].eligibility).toBe('allowed');
    expect(out[11]).toMatchObject({ eligibility: 'disqualified' });
    expect(out[11].reason).toContain('household');
    expect(out[20].eligibility).toBe('allowed');
  });

  it('an unmatched row is always allowed', () => {
    const out = computeEligibility({ today: TODAY, rows: [row(2)], interventionsByPerson: {} });
    expect(out[2].eligibility).toBe('allowed');
  });
});