import { z } from 'zod';

const AddressSchema = z.object({
  street: z.string().optional(),
  barangay: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  postalCode: z.string().optional(),
});

export const IntakeInputSchema = z.object({
  beneficiary: z.object({
    surname: z.string().min(1, 'Surname is required'),
    firstName: z.string().min(1, 'First name is required'),
    middleName: z.string().optional(),
    gender: z.enum(['Male', 'Female']),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
    age: z.number().int().positive().optional(),
    placeOfBirth: z.string().min(1, 'Place of birth is required'),
    civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled']),
    cellularNumber: z.string().min(1, 'Cellular number is required'),
    currentAddress: AddressSchema,
    provincialAddress: AddressSchema,
    philhealthNumber: z.string().optional(),
    occupation: z.string().min(1, 'Occupation is required'),
    estimatedMonthlyIncome: z.number().positive('Estimated monthly income is required'),
  }),
  familyMembers: z.array(z.object({
    fullName: z.string().min(1, 'Name is required'),
    age: z.number().int().positive('Age is required'),
    relationship: z.string().min(1, 'Relationship is required'),
    occupation: z.string().min(1, 'Occupation is required'),
    income: z.number().positive().optional(),
    status: z.string().optional(),
  })).optional(),
  case: z.object({
    serviceRequested: z.array(z.string()).optional(),
    requirementsChecklist: z.record(z.boolean()).optional(),
    assessedBy: z.string().optional(),
    assignedWorkerId: z.string().optional(),
  }),
});

export type IntakeInput = z.infer<typeof IntakeInputSchema>;

export const MatchCheckInputSchema = z.object({
  surname: z.string().min(1),
  firstName: z.string().min(1),
  middleName: z.string().optional(),
  familyMembers: z.array(z.object({
    fullName: z.string().min(1),
  })).optional(),
  barangay: z.string().optional(),
});

export type MatchCheckInput = z.infer<typeof MatchCheckInputSchema>;

export interface MatchCandidate {
  householdId: string;
  score: number;
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
  beneficiaryId: string;
  caseId: string;
  controlNo: string;
  status: string;
  nextEligibleDate: string;
}
