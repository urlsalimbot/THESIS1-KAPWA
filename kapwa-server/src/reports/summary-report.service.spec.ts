import { SummaryReportService } from './summary-report.service';
import { SummaryReportData } from './summary-report.types';

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    case_id: 'c1', created_at: new Date('2025-04-10T02:00:00Z'),
    client_category: null, gender: 'Male',
    surname: 'Magno', first_name: 'Michael', middle_name: 'H',
    barangay: 'Poblacion', service_text: 'Burial Assistance', referral_text: '',
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
});
