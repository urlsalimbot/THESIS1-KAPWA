import { z } from 'zod';
import { computeAgeFromDob } from '../compute-age';

const NAME_EXTENSIONS = ['N/A', 'Jr.', 'Sr.', 'II', 'III', 'IV'] as const;

// A real calendar date, not in the future, and at most 120 years ago. The regex
// alone accepted impossible dates (2026-02-30) and future birthdays.
const dobSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format')
  .refine((d) => {
    const age = computeAgeFromDob(d);
    return !Number.isNaN(age) && age >= 0 && age <= 120;
  }, 'Date of birth must be a real date and at most 120 years ago');

const AddressSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  barangay: z.string().min(1, 'Barangay is required'),
  city: z.string().min(1, 'City is required'),
  province: z.string().min(1, 'Province is required'),
  region: z.string().min(1, 'Region is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  psgcCode: z.string().optional(),
});

const PHONE_REGEX = /^09\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Everything but the contact details, shared by both person shapes.
const PersonBaseSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.enum(NAME_EXTENSIONS).optional(),
  gender: z.enum(['Male', 'Female']),
  dob: dobSchema,
  age: z.number().int().positive().optional(),
  placeOfBirth: z.string().min(1, 'Place of birth is required'),
  civilStatus: z.enum(['Single', 'Married', 'Widowed', 'Separated', 'Annulled']),
  currentAddress: AddressSchema,
  philsysNumber: z.string().optional(),
  occupation: z.string().min(1, 'Occupation is required'),
  estimatedMonthlyIncome: z.number().nonnegative('Monthly income must be 0 or higher'),
  isIndigenous: z.boolean().optional(),
});

/**
 * Contact details are optional for every person on an intake: the household
 * may simply have no phone and no email address, which is common in Norzagaray
 * (walk-ins, elderly clients, one handset shared by a household). Filled-in
 * values still have to be well-formed.
 *
 * The office's channel for such a household is the counter, and the system
 * still gives the claimant a way in: when there is no email and no number,
 * AccountProvisioningService issues a printable claimant ID and a temporary
 * password instead of the one-time setup link.
 */
const PersonOptionalContactSchema = PersonBaseSchema.extend({
  // `.optional()` and not merely "empty string allowed": the key may be absent
  // altogether. The web form always sends `''`, but an intake submitted on a
  // device that simply has no such field was rejected with "Required" — which
  // is the same dead end this whole change exists to remove.
  cellularNumber: z
    .string()
    .refine(v => v === '' || PHONE_REGEX.test(v), 'Must be a valid 11-digit PH mobile number starting with 09')
    .optional(),
  email: z
    .string()
    .refine(v => v === '' || EMAIL_REGEX.test(v), 'Enter a valid email address')
    .optional(),
});

export const FamilyMemberSchema = z.object({
  surname: z.string().min(1, 'Surname is required'),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  extension: z.enum(NAME_EXTENSIONS).optional(),
  gender: z.enum(['Male', 'Female'], { message: 'Sex is required' }),
  dob: dobSchema,
  age: z.number().int().min(0).optional(),
  relationship: z.string().min(1, 'Relationship is required'),
  occupation: z.string().optional(),
  income: z.number().nonnegative('Monthly income must be 0 or higher').optional(),
  status: z.string().optional(),
});

export const SourceReferralSchema = z.object({
  type: z.enum(['barangay']),
  id: z.string().uuid(),
});

export const IntakeInputSchema = z.object({
  beneficiary: PersonOptionalContactSchema,
  claimant: PersonOptionalContactSchema.extend({
    relationshipToBeneficiary: z.string().min(1, 'Relationship to beneficiary is required'),
  }),
  familyMembers: z.array(FamilyMemberSchema).optional(),
  renewalOfCaseId: z.string().uuid().optional(),
  // Referral this intake was handed off from. Linked to the created case
  // inside the intake transaction (IntakeService.linkSourceReferral).
  sourceReferral: SourceReferralSchema.optional(),
  case: z.object({
    serviceRequested: z.array(z.string()).optional(),
    requirementsChecklist: z.record(z.boolean()).optional(),
    assessedBy: z.string().optional(),
    assignedWorkerId: z.string().optional(),
  }),
});

/**
 * What the pipes parse with.
 *
 * This used to add one rule: a self-claim (the beneficiary is also the
 * claimant) had to carry contact details, because the beneficiary was the only
 * reachable person. That rule is gone with the reason for it — an intake of a
 * person with neither email nor mobile number is now valid, and the office
 * issues the account (see the schema comment above). Kept as a named export
 * because the client, the controller and several specs refer to it, and a
 * future refinement belongs here.
 */
export const IntakeInputCheckedSchema = IntakeInputSchema;

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
  // Optional PII. Each is a corroborator or (for unique identifiers) an
  // independent trigger in the match rule; absent when the caller has no value.
  dob: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  philsysNumber: z.string().optional(),
});

export type MatchCheckInput = z.infer<typeof MatchCheckInputSchema>;

export interface MatchCandidate {
  householdId: string;
  score: number;
  /** Human-readable reasons this household was flagged (e.g. "Phone", "DOB + name"). */
  matchedOn: string[];
  caseExistsWithin30Days: boolean;
  primaryBeneficiary: {
    id: string;
    surname: string;
    firstName: string;
    middleName?: string;
    gender: string;
    age: number;
    dob?: string;
    phone: string;
    email?: string;
    occupation: string;
    estimatedMonthlyIncome: number;
    civilStatus: string;
    currentAddress: Record<string, string> | null;
  };
  /** The roster person who actually matched (beneficiary or household member). */
  matchedPerson: {
    id: string;
    role: 'beneficiary' | 'member';
    relationship?: string;
    surname: string;
    firstName: string;
    middleName?: string;
    gender: string;
    age: number;
    dob?: string;
    phone: string;
    email?: string;
    occupation: string;
    estimatedMonthlyIncome: number;
    civilStatus: string;
    currentAddress: Record<string, string> | null;
    category?: string;
  };
  allBeneficiaries: Array<{ id: string; surname: string; firstName: string }>;
  familyMembers: Array<{
    id: string; fullName: string; surname: string; firstName: string;
    middleName?: string; gender: string; dob?: string; civilStatus?: string;
    relationship: string;
    age: number; occupation: string; income: number; status: string;
  }>;
  /** Cases for the household (any beneficiary) plus the matched person's own, newest first. */
  pastCases: Array<{ controlNo: string; beneficiaryName: string; status: string; createdAt: string }>;
  lastApprovedCaseDate: string | null;
}

export const ConfirmMatchInputSchema = IntakeInputSchema.extend({
  // Explicit "update the household, don't open a case". When false, confirmMatch
  // updates the person/beneficiary/claimant/family records and returns without
  // creating a new case even when one would otherwise be issued — the worker may
  // have recognised a duplicate episode and wants the record corrected without a
  // double case. Defaults to the pre-existing behaviour (create, or reuse a
  // recent case).
  createCase: z.boolean().optional(),
});
export type ConfirmMatchInput = z.infer<typeof ConfirmMatchInputSchema>;

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
