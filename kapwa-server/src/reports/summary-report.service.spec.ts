import { SummaryReportService } from './summary-report.service';
import { SummaryReportData } from './summary-report.types';

const PROGRAMS = [
  { id: 'p-burial', name: 'Burial Assistance', category: 'Burial' },
  { id: 'p-med', name: 'Medical Assistance', category: 'Medical' },
  { id: 'p-pao', name: 'Legal Referral (PAO)', category: 'Social Services' },
  { id: 'p-ref', name: 'Referral – Others', category: 'Social Services' },
  { id: 'p-csr', name: 'Case Study Report (CSR)', category: 'Social Services' },
  { id: 'p-hv', name: 'Home Visit', category: 'Family Welfare' },
];

function row(over: Partial<Record<string, unknown>> = {}) {
  return {
    case_id: 'c1', created_at: new Date('2025-04-10T02:00:00Z'),
    client_category: null, gender: 'Male',
    surname: 'Magno', first_name: 'Michael', middle_name: 'H',
    barangay: 'Poblacion', service_text: 'Burial Assistance', referral_text: '', referral_agencies: '',
    latest_intervention_at: null, latest_referral_at: null,
    program_id: null, program_name: null,
    has_csr: false, has_visit: false, ...over,
  };
}

function makeService(rows: any[], programs = PROGRAMS) {
  // Simulate the SQL year-window filter and the programs query.
  const dataSource = {
    query: jest.fn().mockImplementation((sql: string, params: [Date, Date]) => {
      if (/FROM programs/.test(sql)) return Promise.resolve(programs);
      return Promise.resolve(
        rows.filter((r) => {
          const t = new Date(r.created_at).getTime();
          return t >= params[0].getTime() && t < params[1].getTime();
        }),
      );
    }),
  };
  const org = { officeName: jest.fn().mockResolvedValue('Municipal Social Welfare and Development Office') };
  const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
  return { service: new SummaryReportService(dataSource as any, org as any, userRepo as any), dataSource };
}

function columnKeys(data: SummaryReportData): string[] {
  return data.columns.map(c => c.key);
}

describe('SummaryReportService.build', () => {
  it('keeps one-column-per-case and male+female = total = sum(columns)', async () => {
    const { service } = makeService([
      row({ case_id: 'c1', gender: 'Male', program_id: 'p-burial', program_name: 'Burial Assistance' }),
      row({ case_id: 'c2', gender: 'Female', program_id: 'p-med', program_name: 'Medical Assistance' }),
      row({ case_id: 'c3', gender: 'Female', referral_text: 'Referred to PCSO' }),
      row({ case_id: 'c4', gender: 'Male', has_csr: true }),
    ]);
    const data = await service.build(2025, 2);
    const c = data.annual.counts;
    expect(c.male + c.female).toBe(c.total);
    expect(c.total).toBe(4);
    const colTotal = data.columns
      .filter(col => !['MALE', 'FEMALE', 'TOTAL'].includes(col.key))
      .reduce((s, col) => s + (c.byColumn[col.key] ?? 0), 0);
    expect(colTotal).toBe(c.total);
    expect(c.byColumn['p-burial']).toBe(1);
    expect(c.byColumn['p-med']).toBe(1);
    expect(c.byColumn['p-csr']).toBe(1);
  });

  it('builds three month tables plus a quarter summary for Q2', async () => {
    const { service } = makeService([
      row({ created_at: new Date('2025-05-02T02:00:00Z'), program_id: 'p-med', program_name: 'Medical Assistance' }),
    ]);
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

  it('includes program-driven columns plus UNASSIGNED and TOTAL', async () => {
    const { service } = makeService([]);
    const data = await service.build(2025, 2);
    const keys = columnKeys(data);
    expect(keys[0]).toBe('MALE');
    expect(keys[1]).toBe('FEMALE');
    expect(keys).toContain('p-burial');
    expect(keys).toContain('p-csr');
    expect(keys[keys.length - 2]).toBe('UNASSIGNED');
    expect(keys[keys.length - 1]).toBe('TOTAL');
  });

  it('classifies case-list categories and remark code', async () => {
    const { service } = makeService([
      row({ case_id: 'c9', gender: 'Female', client_category: 'IP', has_csr: true }),
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
    // No referral → falls back to the derived intervention code (here: nothing
    // recordable, so the remark is empty).
    expect(data.caseList[2].intervention).toBe('');
  });

  it('applies recency precedence: referral is the final remark only when added last', async () => {
    const { service } = makeService([
      row({
        case_id: 'c13', referral_agencies: 'PAO',
        latest_intervention_at: new Date('2025-04-01T01:00:00Z'),
        latest_referral_at: new Date('2025-04-02T01:00:00Z'),
      }),
      row({
        case_id: 'c14', referral_agencies: 'PCSO',
        program_id: 'p-burial', program_name: 'Burial Assistance',
        latest_intervention_at: new Date('2025-04-03T01:00:00Z'),
        latest_referral_at: new Date('2025-04-01T01:00:00Z'),
      }),
      row({ case_id: 'c15', referral_agencies: 'DSWD FO3' }),
    ]);
    const data: SummaryReportData = await service.build(2025, 2);
    expect(data.caseList[0].intervention).toBe('Referred to PAO');
    expect(data.caseList[1].intervention).toBe('FA');
    expect(data.caseList[2].intervention).toBe('Referred to DSWD FO3');
  });
});