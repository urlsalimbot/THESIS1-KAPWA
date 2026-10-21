import { PROGRAMS } from './seed-programs';

describe('program seed data', () => {
  const byName = (needle: RegExp) => PROGRAMS.filter(p => needle.test(p.name));
  const names = new Set(PROGRAMS.map(p => p.name));

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

  it('models AICS as the typed crisis programme, under its current guideline', () => {
    const [aics] = byName(/AICS/);
    expect(aics).toBeDefined();
    expect(aics.programType).toBe('aics');
    expect(aics.legalBasis).toContain('MC No. 15 s. 2022');
    expect(aics.legalBasis).not.toContain('MC No. 5 s.2021');
    // DSWD assistance types are services under AICS, not separate programmes.
    for (const service of [
      'medical_assistance', 'burial_assistance', 'transport_assistance',
      'educational_assistance', 'food_pack', 'financial_grant',
      'assistive_device', 'referral_pao', 'crisis_counseling', 'psychosocial_support',
    ]) {
      expect(aics.interventions).toContain(service);
    }
  });

  it('keeps the PWD programme under its official name and the Balik service type', () => {
    expect(names.has('Program for Persons with Disabilities (PWDs)')).toBe(true);
    const [pwd] = byName(/Persons with Disabilities/);
    expect(pwd.interventions).toContain('assistive_device');
    const [balik] = byName(/Balik Probinsya/);
    expect(balik.interventions).toContain('balik_probinsya');
  });

  it('does not seed assistance types or report artefacts as programmes', () => {
    for (const falseProgram of [
      'Medical Assistance', 'Burial Assistance', 'Transportation Assistance',
      'Food Assistance', 'Financial Assistance (General)', 'Educational Assistance',
      'Crisis Intervention & Psychosocial Support', 'Referral and Linkage Services',
      'Assistive Device Support', 'Legal Referral (PAO)', 'Referral – Others',
      'Birth Discrepancy Assistance', 'Case Study Report (CSR)', 'Home Visit',
      'PhilHealth Assistance', 'Child Custody Support', 'Travel Assessment',
      'Medical Equipment Loan', 'UPLIFT (Economic Empowerment)',
    ]) {
      expect(names.has(falseProgram)).toBe(false);
    }
  });

  it('keeps every programme typed and every id unique', () => {
    const ids = PROGRAMS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(PROGRAMS.filter(p => !p.programType)).toEqual([]);
  });
});
