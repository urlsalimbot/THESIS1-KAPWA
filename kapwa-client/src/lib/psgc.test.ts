import { describe, it, expect } from 'vitest';
import { psgcNameFor, addressNames } from './psgc';

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
