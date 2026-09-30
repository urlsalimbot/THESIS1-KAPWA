import { describe, it, expect } from 'vitest';
import { psgcNameFor, addressNames, barangayNamesForMuncity, NORZAGARAY_MUNCITY_CODE } from './psgc';
import psgcRaw from './psgc.json';

describe('psgc helpers', () => {
  it('resolves PSGC codes to names', () => {
    expect(psgcNameFor('0301413000')).toBe('Norzagaray');
    expect(psgcNameFor('0301400000')).toBe('Bulacan');
  });

  it('passes names and blanks through unchanged', () => {
    expect(psgcNameFor('Poblacion')).toBe('Poblacion');
    expect(psgcNameFor('')).toBe('');
    expect(psgcNameFor(null)).toBe('');
  });

  it('assembles a display address from mixed codes and names', () => {
    expect(addressNames({ barangay: 'Poblacion', city: '0301413000', province: '0301400000' }))
      .toBe('Poblacion, Norzagaray, Bulacan');
    expect(addressNames({ barangay: 'Poblacion', city: 'Norzagaray', province: 'Bulacan' }))
      .toBe('Poblacion, Norzagaray, Bulacan');
    expect(addressNames(null)).toBe('');
  });
});

describe('barangayNamesForMuncity', () => {
  /**
   * The referral form offers these names, and a referral's address prefills
   * `currentAddress.barangay` in the intake, whose select matches its options by
   * name. If the two lists ever drift, the referral submits cleanly and the
   * intake then renders a blank select — a mismatch with no error anywhere. So
   * this compares the two derivations instead of restating a list.
   */
  it('returns exactly what the intake address block offers for its default city', () => {
    type Brgy = { code: string; name: string };
    type Mun = { code: string; name: string; barangays: Brgy[] };
    const regions = psgcRaw as Array<{ provinces: Array<{ muncities: Mun[] }> }>;
    let intakeList: string[] = [];
    for (const r of regions) {
      for (const p of r.provinces) {
        const m = p.muncities.find((x) => x.code === NORZAGARAY_MUNCITY_CODE);
        if (m) intakeList = m.barangays.map((b) => b.name);
      }
    }
    expect(barangayNamesForMuncity(NORZAGARAY_MUNCITY_CODE)).toEqual(intakeList);
    expect(intakeList).toHaveLength(13);
  });

  it('returns names, not codes, because the address records store names', () => {
    const names = barangayNamesForMuncity(NORZAGARAY_MUNCITY_CODE);
    expect(names).toContain('Bigte');
    expect(names.every((n) => !/^\d+$/.test(n))).toBe(true);
    // A code stored as the barangay would miss the by-name lookup the intake
    // select performs, and render blank.
    expect(names).not.toContain('0301413006');
  });

  it('returns nothing for an unknown municipality instead of throwing', () => {
    expect(barangayNamesForMuncity('9999999999')).toEqual([]);
    expect(barangayNamesForMuncity('')).toEqual([]);
  });
});
