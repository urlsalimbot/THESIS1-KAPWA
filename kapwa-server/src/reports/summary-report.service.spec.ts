import { SummaryReportService } from './summary-report.service';
import { SummaryReportData } from './summary-report.types';

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    case_id: 'c1', created_at: new Date('2025-04-10T02:00:00Z'),
    client_category: null, gender: 'Male',
    surname: 'Magno', first_name: 'Michael', middle_name: 'H',
    barangay: 'Poblacion', service_text: 'Burial Assistance', referral_text: '', referral_agencies: '',
    latest_intervention_at: null, latest_referral_at: null,
    has_csr: false, has_visit: false, ...over,
  };
}

function makeService(rows: any[]) {
  // Simulate the SQL year-window filter so boundary assertions are meaningful:
  // only rows inside the passed [start, end) window are returned.
  const dataSource = {
    query: jest.fn().mockImplementation((_sql: string, params: [Date, Date]) =>
      Promise.resolve(
        rows.filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= params[0].getTime() && t < params[1].getTime();
        }),
      ),
    ),
  };
  const org = { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') };
  const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
  return { service: new SummaryReportService(dataSource as any, org as any, userRepo as any), dataSource };
}

describe('SummaryReportService.build', () => {
  it('keeps one-category-per-case and male+female = total = sum(categories)', async () => {
    const { service } = makeService([
      row({ case_id: 'c1', gender: 'Male', service_text: 'Burial Assistance' }),
      row({ case_id: 'c2', gender: 'Female', service_text: 'Medical Assistance' }),
      row({ case_id: 'c3', gender: 'Female', service_text: 'Assistive Device' }),
    ]);
    const data = await service.build(2025, 2);
    const c = data.annual.counts;
    expect(c.male + c.female).toBe(c.total);
    expect(c.total).toBe(3);
    expect(Object.values(c.byCategory).reduce((a, b) => a + b, 0)).toBe(c.total);
    expect(c.byCategory.BURIAL).toBe(1);
    expect(c.byCategory.MEDICAL).toBe(1);
    expect(c.byCategory.ASSISTIVE).toBe(1);
  });

  it('builds three month tables plus a quarter summary for Q2', async () => {
    const { service } = makeService([row({ created_at: new Date('2025-05-02T02:00:00Z'), service_text: 'Medical' })]);
    const data = await service.build(2025, 2);
    expect(data.monthly.map((m) => m.title)).toEqual(['April 1-30, 2025', 'May 1-31, 2025', 'June 1-30, 2025']);
    expect(data.monthly[1].counts.total).toBe(1);
    expect(data.quarterSummary.title).toBe('2nd QUARTER SUMMARY');
  });

  it('uses leap-year February and falls back to constants when no users exist', async () => {
    const { service } = makeService([]);
    const data = await service.build(2024, 1);
    expect(data.monthly[1].title).toBe('February 1-29, 2024');
    expect(data.preparedBy.length).toBeGreaterThan(0);
    expect(data.notedBy.length).toBeGreaterThan(0);
  });

  it('uses Asia/Manila month boundaries for the first month of a quarter', async () => {
    const { service } = makeService([
      row({ case_id: 'in', created_at: new Date('2025-04-01T07:59:00+08:00') }),
      row({ case_id: 'out', created_at: new Date('2025-03-31T23:59:00+08:00') }),
    ]);
    const data = await service.build(2025, 2);
    expect(data.monthly[0].title).toBe('April 1-30, 2025');
    expect(data.monthly[0].counts.total).toBe(1);
    expect(data.quarterSummary.counts.total).toBe(1);
  });

  it('includes cases from the first Manila hour of the year', async () => {
    const { service, dataSource } = makeService([
      row({ case_id: 'ny', created_at: new Date('2025-01-01T00:00:30+08:00') }),
    ]);
    const data = await service.build(2025, 1);
    expect(data.annual.counts.total).toBe(1);
    // Year window must be Manila midnight, i.e. 16:00Z on the prior day.
    const [, params] = dataSource.query.mock.calls[0];
    expect((params[0] as Date).toISOString()).toBe('2024-12-31T16:00:00.000Z');
    expect((params[1] as Date).toISOString()).toBe('2025-12-31T16:00:00.000Z');
  });

  it('renders the case-list date in Manila local time', async () => {
    const { service } = makeService([
      row({ case_id: 'm', created_at: new Date('2025-04-01T00:30:00+08:00') }),
    ]);
    const data = await service.build(2025, 2);
    expect(data.caseList[0].date).toBe('04-01-25');
  });

  it('classifies case-list categories and intervention code', async () => {
    const { service } = makeService([
      row({ case_id: 'c9', gender: 'Female', client_category: 'IP', service_text: 'Certification', has_csr: true }),
    ]);
    const data: SummaryReportData = await service.build(2025, 2);
    const r = data.caseList[0];
    expect(r.gender).toBe('F');
    expect(r.categories.ip).toBe(true);
    expect(r.intervention).toBe('CSR');
  });

  it('uses a referral to another agency as the final remark', async () => {
    const { service } = makeService([
      row({ case_id: 'c10', referral_agencies: 'PAO' }),
      row({ case_id: 'c11', referral_agencies: 'DSWD Field Office III, PCSO' }),
      row({ case_id: 'c12', referral_agencies: '' }),
    ]);
    const data: SummaryReportData = await service.build(2025, 2);
    expect(data.caseList[0].intervention).toBe('Referred to PAO');
    expect(data.caseList[1].intervention).toBe('Referred to DSWD Field Office III, PCSO');
    // No referral → falls back to the derived intervention code.
    expect(data.caseList[2].intervention).toBe('FA');
  });

  it('applies recency precedence: referral is the final remark only when added last', async () => {
    const { service } = makeService([
      // Referral added AFTER the intervention → referral remark.
      row({
        case_id: 'c13', referral_agencies: 'PAO',
        latest_intervention_at: new Date('2025-04-01T01:00:00Z'),
        latest_referral_at: new Date('2025-04-02T01:00:00Z'),
      }),
      // Intervention added AFTER the referral → derived intervention code.
      row({
        case_id: 'c14', referral_agencies: 'PCSO',
        service_text: 'Burial Assistance',
        latest_intervention_at: new Date('2025-04-03T01:00:00Z'),
        latest_referral_at: new Date('2025-04-01T01:00:00Z'),
      }),
      // Tie (unknown timestamps) → referral wins.
      row({ case_id: 'c15', referral_agencies: 'DSWD FO3' }),
    ]);
    const data: SummaryReportData = await service.build(2025, 2);
    expect(data.caseList[0].intervention).toBe('Referred to PAO');
    expect(data.caseList[1].intervention).toBe('FA');
    expect(data.caseList[2].intervention).toBe('Referred to DSWD FO3');
  });
});
