import { describe, it, expect } from 'vitest';
import { exportFileName } from './export-filename';

describe('exportFileName', () => {
  it('formats as CaseType caseNumber-YYYY-MM-DD.pdf', () => {
    const d = new Date(2026, 8, 9);
    expect(exportFileName('GIS', 'KAPWA-2026-00006', d)).toBe('GIS KAPWA-2026-00006-2026-09-09.pdf');
  });

  it('pads month and day to two digits', () => {
    const d = new Date(2026, 0, 5);
    expect(exportFileName('ACCESS CARD', 'NORZ-AC-2026-0001', d)).toBe('ACCESS CARD NORZ-AC-2026-0001-2026-01-05.pdf');
  });

  it('defaults the date to now', () => {
    const name = exportFileName('IRF', 'BLT-2026-0001');
    expect(name).toMatch(/^IRF BLT-2026-0001-\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
