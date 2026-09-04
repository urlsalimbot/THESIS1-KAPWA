import { z } from 'zod';
import { computeAgeFromDob } from '../compute-age';

const NAME_EXTENSIONS = ['N/A', 'Jr.', 'Sr.', 'II', 'III', 'IV'] as const;

const AddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  region: z.string().min(1, 'Region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  psgcCode: z.string().optional(),
});

const PersonSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.enum(NAME_EXTENSIONS).optional(),
  gender: z.enum(['Male', 'Female']),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  age: z.number().int().positive().optional(),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled']),
  cellularNumber: z.string().regex(/^09\d{9}$/, 'Must be a valid 11-digit PH mobile number starting with 09'),
  email: z.string().email('Email is required').min(1, 'Email is required'),
  currentAddress: AddressSchema,
  philhealthNumber: z.string().optional(),
  occupation: z.string().min(1, 'Occupation is required'),
  estimatedMonthlyIncome: z.number().nonnegative('Monthly income must be 0 or higher'),
});

export const FamilyMemberSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.enum(NAME_EXTENSIONS).optional(),
  gender: z.enum(['Male', 'Female'], { message: 'Sex is required' }),
  dob: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
    .refine((d) => {
      const age = computeAgeFromDob(d);
      return !Number.isNaN(age) && age >= 0 && age <= 120;
    }, 'Date of birth must be a real date and at most 120 years ago'),
  age: z.number().int().min(0).optional(),
  relationship: z.string().min(1, 'Relationship is required'),
  occupation: z.string().optional(),
  income: z.number().nonnegative('Monthly income must be 0 or higher').optional(),
  status: z.string().optional(),
});

export const IntakeInputSchema = z.object({
  beneficiary: PersonSchema,
  claimant: PersonSchema.extend({
    relationshipToBeneficiary: z.string().min(1, 'Relationship to beneficiary is required'),
  }),
  familyMembers: z.array(FamilyMemberSchema).optional(),
  renewalOfCaseId: z.string().uuid().optional(),
  case: z.object({
    serviceRequested: z.array(z.string()).optional(),
    requirementsChecklist: z.record(z.boolean()).optional(),
    assessedBy: z.string().optional(),
    assignedWorkerId: z.string().optional(),
  }),
});

export const batchFamilySchema = z.object({
  caseId: z.string().min(1, 'caseId is required'),
  primary: PersonSchema.partial(),
  members: z.array(FamilyMemberSchema),
});

export type BatchFamilyInput = z.infer<typeof batchFamilySchema>;

export type FamilyMemberInput = z.infer<typeof FamilyMemberSchema>;

export type IntakeInput = z.infer<typeof IntakeInputSchema>;

export const MatchCheckInputSchema = z.object({
  surname: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  familyMembers: z.array(z.object({
    surname: z.string().min(1),
    firstName: z.string().min(1),
  })).optional(),
  barangay: z.string().optional(),
});

export type MatchCheckInput = z.infer<typeof MatchCheckInputSchema>;

export interface MatchCandidate {
  householdId: string;
  score: number;
  caseExistsWithin30Days: boolean;
  primaryBeneficiary: {
    id: string;
    surname: string;
    firstName: string;
    middleName?: string;
    gender: string;
    age: number;
    phone: string;
    occupation: string;
    estimatedMonthlyIncome: number;
    civilStatus: string;
    currentAddress: Record<string, string> | null;
    philhealthNumber?: string;
    category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{ id: string; fullName: string; relationship: string; age: number; occupation: string; income: number; status: string }>;
  lastApprovedCaseDate: string | null;
}

export const ConfirmMatchInputSchema = IntakeInputSchema;
export type ConfirmMatchInput = IntakeInput;

export interface ConfirmMatchResponse {
  updated: boolean;
  caseCreated: boolean;
  beneficiaryId: string;
  caseId: string | null;
  controlNo: string | null;
  status: string | null;
  existingCaseDate: string | null;
  message: string;
}
