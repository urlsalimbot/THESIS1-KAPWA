import { z } from 'zod';

const PHONE_REGEX = /^09\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function computeAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Everything but the contact details. Contacts are assembled conditionally so
// a beneficiary claimed by someone else may omit them (the claimant is the
// reachable person); a self-claiming beneficiary still must supply them.
const baseShape = {
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.string().optional(),
  gender: z.enum(['Male', 'Female'], 'Sex is required'),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').refine(val => {
    const age = computeAge(val);
    return age >= 0 && age <= 120;
  }, 'Age must be between 0 and 120'),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled'], 'Civil status is required'),
  street: z.string().min(1, 'Street is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  city: z.string().min(1, 'City/Municipality is required'),
  province: z.string().min(1, 'Province is required'),
  region: z.string().min(1, 'Region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  philsysNumber: z.string().optional(),
  occupation: z.string().min(1, 'Occupation is required'),
  estimatedMonthlyIncome: z.string().refine(val => {
    const num = parseFloat(val.replace(/,/g, ''));
    return !isNaN(num) && num >= 0;
  }, 'Monthly income must be 0 or higher'),
  isIndigenous: z.boolean().optional(),
};

const requiredContactShape = {
  cellularNumber: z.string().regex(PHONE_REGEX, 'Must be a valid 11-digit mobile number starting with 09'),
  email: z.string().email('Enter a valid email address'),
};

const optionalContactShape = {
  // Empty means "not provided" (allowed for a beneficiary claimed by someone
  // else); anything filled in must still be well-formed.
  cellularNumber: z.string().refine(v => !v || PHONE_REGEX.test(v), 'Must be a valid 11-digit mobile number starting with 09'),
  email: z.string().refine(v => !v || EMAIL_REGEX.test(v), 'Enter a valid email address'),
};

function personSchema(requireContact: boolean) {
  return z.object({
    ...baseShape,
    ...(requireContact ? requiredContactShape : optionalContactShape),
  });
}

export interface PersonFormValues {
  surname: string; firstName: string; middleName: string; extension: string;
  gender: string; dob: string; placeOfBirth: string; civilStatus: string;
  cellularNumber: string; email: string; street: string; barangay: string;
  city: string; province: string; region: string; postalCode: string;
  philsysNumber: string; occupation: string; estimatedMonthlyIncome: string;
  isIndigenous?: boolean;
}

export type ValidationErrors = Record<string, string>;

/**
 * Validate a person form. `requireContact` is false by default: an intake is
 * allowed to carry nobody's email address or mobile number (the household may
 * have neither), and the office issues a claimant ID and a temporary password
 * when that happens. Pass `true` only where a contact is genuinely needed —
 * nothing in the intake does today.
 */
export function validatePerson(values: PersonFormValues, requireContact = false): ValidationErrors {
  const result = personSchema(requireContact).safeParse(values);
  if (result.success) return {};
  const errors: ValidationErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = issue.message;
  }
  return errors;
}

export function validateField(values: PersonFormValues, field: string, requireContact = false): string {
  const schema = personSchema(requireContact).shape[field as keyof ReturnType<typeof personSchema>['shape']];
  if (!schema) return '';
  const value = values[field as keyof PersonFormValues];
  const result = schema.safeParse(value);
  if (result.success) return '';
  return result.error.issues[0]?.message || '';
}
