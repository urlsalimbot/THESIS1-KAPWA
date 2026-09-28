import { BARANGAYS, BARANGAY_NAMES, exportFileName } from './constants';

describe('BARANGAY_NAMES', () => {
  // MSWDO Norzagaray operates 13 barangays — no more, no fewer. This list is
  // the enforcement point for `users.assigned_barangay`, which the access-card
  // write path copies into `access_card_services.source_barangay`. A value that
  // is not here means rows no list query will ever match.
  it('holds exactly the 13 Norzagaray barangays', () => {
    expect(BARANGAY_NAMES).toEqual([
      'Bangkal',
      'Baraka',
      'Bigte',
      'Bitungol',
      'Friendship Village Resources (FVR)',
      'Matictic',
      'Minuyan',
      'Partida',
      'Pinagtulayan',
      'Poblacion',
      'San Lorenzo',
      'San Mateo',
      'Tigbe',
    ]);
  });

  it('has no duplicates', () => {
    expect(new Set(BARANGAY_NAMES).size).toBe(BARANGAY_NAMES.length);
  });

  it('covers every seeded slug/name pair', () => {
    expect(BARANGAYS).toHaveLength(BARANGAY_NAMES.length);
    for (const b of BARANGAYS) {
      expect(BARANGAY_NAMES).toContain(b.name);
    }
  });

  it('has unique slugs', () => {
    const slugs = BARANGAYS.map(b => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

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
