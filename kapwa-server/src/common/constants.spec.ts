import { exportFileName } from './constants';

describe('exportFileName', () => {
  it('formats as CaseType caseNumber-YYYY-MM-DD.pdf', () => {
    const d = new Date(2026, 8, 9);
    expect(exportFileName('GIS', 'KAPWA-2026-00006', d)).toBe('GIS KAPWA-2026-00006-2026-09-09.pdf');
  });

  it('pads month and day to two digits', () => {
    const d = new Date(2026, 0, 5);
    expect(exportFileName('IRF', 'BLT-2026-0001', d)).toBe('IRF BLT-2026-0001-2026-01-05.pdf');
  });

  it('defaults the date to now', () => {
    const name = exportFileName('CSR', 'KAPWA-2026-00007');
    expect(name).toMatch(/^CSR KAPWA-2026-00007-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
