import { describe, it, expect } from 'vitest';
import { validatePerson, validateField } from './useIntakeValidation';

const validPerson = {
  surname: 'Dela Cruz', firstName: 'Juan', middleName: '', extension: '',
  gender: 'Male', dob: '1990-01-15', placeOfBirth: 'Manila', civilStatus: 'Single',
  cellularNumber: '09171234567', email: 'juan@example.com',
  street: '123 Rizal St', barangay: 'Bangkal', city: 'Norzagaray',
  province: '0314000000', region: '03', postalCode: '3012',
  philhealthNumber: '', occupation: 'Fisherman', estimatedMonthlyIncome: '15000',
};

describe('validatePerson', () => {
  it('returns no errors for valid data', () => {
    expect(validatePerson(validPerson)).toEqual({});
  });

  it('returns error for missing surname', () => {
    const errs = validatePerson({ ...validPerson, surname: '' });
    expect(Object.values(errs)).toContain('Surname is required');
  });

  it('returns error for invalid phone', () => {
    const errs = validatePerson({ ...validPerson, cellularNumber: '12345' });
    expect(Object.values(errs)).toContain('Must be a valid 11-digit mobile number starting with 09');
  });

  it('returns error for invalid email', () => {
    const errs = validatePerson({ ...validPerson, email: 'notanemail' });
    expect(Object.values(errs)).toContain('Enter a valid email address');
  });

  it('returns error for age > 120', () => {
    const errs = validatePerson({ ...validPerson, dob: '1800-01-01' });
    expect(Object.values(errs)).toContain('Age must be between 0 and 120');
  });

  it('returns error for missing address fields', () => {
    const errs = validatePerson({ ...validPerson, street: '' });
    expect(Object.values(errs)).toContain('Street is required');
  });

  it('returns error for missing barangay', () => {
    const errs = validatePerson({ ...validPerson, barangay: '' });
    expect(Object.values(errs)).toContain('Barangay is required');
  });

  it('allows 0 income', () => {
    const errs = validatePerson({ ...validPerson, estimatedMonthlyIncome: '0' });
    expect(Object.values(errs)).not.toContain('Monthly income must be 0 or higher');
  });
});

describe('validateField', () => {
  it('returns empty for valid field', () => {
    expect(validateField(validPerson, 'surname')).toBe('');
  });

  it('returns error for invalid field', () => {
    expect(validateField({ ...validPerson, surname: '' }, 'surname')).toBe('Surname is required');
  });
});
