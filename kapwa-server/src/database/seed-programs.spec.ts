import { PROGRAMS } from './seed-programs';

describe('program seed data', () => {
  const byName = (needle: RegExp) => PROGRAMS.filter(p => needle.test(p.name));

  it('includes the 4Ps national CCT program with fund source and legal basis', () => {
    const [fourPs] = byName(/4Ps/i);
    expect(fourPs).toBeDefined();
    expect(fourPs.category).toBe('CCT');
    expect(fourPs.fundSources).toContain('DSWD - 4Ps National');
    expect(fourPs.legalBasis).toContain('RA 11310');
    expect(fourPs.requiredDocuments).toContain('4Ps Household ID');
  });

  it('includes KALAHI-CIDSS as a DSWD-funded community program', () => {
    const [kalahi] = byName(/KALAHI-CIDSS/i);
    expect(kalahi).toBeDefined();
    expect(kalahi.fundSources).toContain('DSWD - KALAHI-CIDSS');
    expect(kalahi.legalBasis).toContain('RA 7160');
    expect(kalahi.legalBasis).toContain('NCDDP');
  });

  it('includes Walang Gutom with its fund source', () => {
    const [walangGutom] = byName(/Walang Gutom/i);
    expect(walangGutom).toBeDefined();
    expect(walangGutom.fundSources).toContain('DSWD - Walang Gutom Food Stamp');
    expect(walangGutom.legalBasis).toContain('EO 44 s. 2023');
    expect(walangGutom.legalBasis).toContain('Walang Gutom 2027');
  });

  it('includes UPLIFT with its fund source', () => {
    const [uplift] = byName(/UPLIFT/i);
    expect(uplift).toBeDefined();
    expect(uplift.fundSources).toContain('DSWD - UPLIFT');
    expect(uplift.legalBasis).toContain('EO 110');
  });

  it('keeps every program id unique', () => {
    const ids = PROGRAMS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
