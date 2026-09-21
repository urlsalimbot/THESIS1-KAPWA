import { describe, it, expect } from 'vitest';
import {
  referralListName,
  referralFullName,
  referralPrefill,
  referralIntakeState,
} from './referral-utils';

const FULL = {
  surname: 'Dela Cruz',
  firstName: 'Juan',
  middleName: 'Santos',
  extension: 'Jr.',
};

describe('referral display names', () => {
  it('builds the list form with middle name and extension', () => {
    expect(referralListName(FULL)).toBe('Dela Cruz Jr., Juan Santos');
  });

  it('builds the inline form in given-name order', () => {
    expect(referralFullName(FULL)).toBe('Juan Santos Dela Cruz Jr.');
  });

  it('omits missing name parts without leaving stray separators', () => {
    expect(referralListName({ surname: 'Reyes', firstName: 'Maria' })).toBe('Reyes, Maria');
    expect(referralFullName({ surname: 'Reyes' })).toBe('Reyes');
  });

  it('returns an empty string for a missing person', () => {
    expect(referralListName(undefined)).toBe('');
    expect(referralFullName(null)).toBe('');
  });
});

describe('referralPrefill', () => {
  it('carries identity fields and a valid phone number', () => {
    const { prefill } = referralPrefill({ ...FULL, gender: 'Male', dob: '1990-05-15', phone: '0917 123 4567' });

    expect(prefill.surname).toBe('Dela Cruz');
    expect(prefill.firstName).toBe('Juan');
    expect(prefill.middleName).toBe('Santos');
    expect(prefill.extension).toBe('Jr.');
    expect(prefill.gender).toBe('Male');
    expect(prefill.dob).toBe('1990-05-15');
    expect(prefill.cellularNumber).toBe('09171234567');
  });

  it('drops a phone that is not a valid 09XXXXXXXXX', () => {
    // The intake validates /^09\d{9}$/, so an unsubmittable value must not be
    // pre-filled into the field.
    const { prefill } = referralPrefill({ ...FULL, phone: '0917XXX-XXXX' });
    expect(prefill.cellularNumber).toBe('');
  });

  it('drops an extension outside the intake enum', () => {
    const { prefill } = referralPrefill({ ...FULL, extension: 'Jr' }); // missing period
    expect(prefill.extension).toBe('');
  });

  it('keeps a street only when a structured barangay anchors it', () => {
    const withBarangay = referralPrefill({
      ...FULL,
      addressLine: '123 Mabini St, Poblacion',
      currentAddress: { barangay: 'Poblacion' },
    });
    expect(withBarangay.prefill.currentAddress).toEqual({
      street: '123 Mabini St',
      barangay: 'Poblacion',
    });

    const withoutBarangay = referralPrefill({
      ...FULL,
      addressLine: '123 Mabini St, Poblacion',
    });
    expect(withoutBarangay.prefill.currentAddress).toEqual({ street: '', barangay: '' });
  });

  it('falls back to the address object when currentAddress is absent', () => {
    const { prefill } = referralPrefill({ ...FULL, address: { barangay: 'Bigte' } });
    expect(prefill.currentAddress.barangay).toBe('Bigte');
  });

  it('returns empty values for an empty referral', () => {
    const { prefill, reason } = referralPrefill({});
    expect(prefill).toEqual({
      surname: '',
      firstName: '',
      middleName: '',
      extension: '',
      gender: '',
      dob: '',
      cellularNumber: '',
      currentAddress: { street: '', barangay: '' },
    });
    expect(reason).toBe('');
  });
});

describe('referralIntakeState', () => {
  it('carries the referral type, id and reason alongside the prefill', () => {
    const state = referralIntakeState('inter_agency', {
      id: 'ref-9',
      ...FULL,
      reason: 'Medical assistance',
    });

    expect(state.sourceReferral).toEqual({
      type: 'inter_agency',
      id: 'ref-9',
      reason: 'Medical assistance',
    });
    expect(state.prefill.firstName).toBe('Juan');
  });

  it('defaults the reason to an empty string', () => {
    const state = referralIntakeState('barangay', { id: 'ref-1', ...FULL });
    expect(state.sourceReferral.reason).toBe('');
  });
});
