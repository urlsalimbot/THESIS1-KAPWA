import { z } from 'zod';

const PHONE_REGEX = /^09\d{9}$/;

function computeAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const personSchema = z.object({
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
  cellularNumber: z.string().regex(PHONE_REGEX, 'Must be a valid 11-digit mobile number starting with 09'),
  email: z.string().email('Enter a valid email address'),
  street: z.string().min(1, 'Street is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  city: z.string().min(1, 'City/Municipality is required'),
  province: z.string().min(1, 'Province is required'),
  region: z.string().min(1, 'Region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  philhealthNumber: z.string().optional(),
  occupation: z.string().min(1, 'Occupation is required'),
  estimatedMonthlyIncome: z.string().refine(val => {
    const num = parseFloat(val.replace(/,/g, ''));
    return !isNaN(num) && num >= 0;
  }, 'Monthly income must be 0 or higher'),
});

export interface PersonFormValues {
  surname: string; firstName: string; middleName: string; extension: string;
  gender: string; dob: string; placeOfBirth: string; civilStatus: string;
  cellularNumber: string; email: string; street: string; barangay: string;
  city: string; province: string; region: string; postalCode: string;
  philhealthNumber: string; occupation: string; estimatedMonthlyIncome: string;
}

export type ValidationErrors = Record<string, string>;

export function validatePerson(values: PersonFormValues): ValidationErrors {
  const result = personSchema.safeParse(values);
  if (result.success) return {};
  const errors: ValidationErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) errors[path] = issue.message;
  }
  return errors;
}

export function validateField(values: PersonFormValues, field: string): string {
  const schema = personSchema.shape[field as keyof typeof personSchema.shape];
  if (!schema) return '';
  const value = values[field as keyof PersonFormValues];
  const result = schema.safeParse(value);
  if (result.success) return '';
  return result.error.issues[0]?.message || '';
}
