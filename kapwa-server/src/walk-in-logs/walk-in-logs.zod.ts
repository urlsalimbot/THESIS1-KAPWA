import { z } from 'zod';

export const WALK_IN_PURPOSE_CODES = [
  'aics_medical', 'aics_burial', 'aics_transport', 'aics_food', 'aics_education',
  'aics_financial', 'scsr', 'referral', 'indigency', 'pwd_id', 'senior_id',
  'solo_parent_id', 'vawc', 'child_protection', 'inquiry', 'follow_up',
  'document_claim', 'other',
] as const;

export const WALK_IN_STATUSES = [
  'waiting', 'in_service', 'completed', 'referred', 'incomplete', 'no_service',
] as const;

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const CreateWalkInLogSchema = z.object({
  visitedAt: z.string().datetime({ offset: true }).optional(),
  firstName: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  middleName: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  lastName: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  extension: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
  personId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  pendingIntakeId: z.string().uuid().optional(),
  referralId: z.string().uuid().optional(),
  barangay: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
  sex: z.enum(['Male', 'Female', 'Other']).optional(),
  dateOfBirth: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
  contactNumber: z.preprocess(emptyToUndefined, z.string().max(30).optional()),
  purposeCode: z.enum(WALK_IN_PURPOSE_CODES),
  purposeText: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
  isNewClient: z.boolean().optional(),
  assignedToId: z.string().uuid().optional(),
  outcome: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  outcomeNotes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});
export type CreateWalkInLogInput = z.infer<typeof CreateWalkInLogSchema>;

export const UpdateWalkInLogSchema = CreateWalkInLogSchema.partial().extend({
  status: z.enum(WALK_IN_STATUSES).optional(),
});
export type UpdateWalkInLogInput = z.infer<typeof UpdateWalkInLogSchema>;

export const LinkOptionsQuerySchema = z.object({ q: z.string().min(2).max(100) });
