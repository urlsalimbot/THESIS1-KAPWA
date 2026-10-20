import { z } from 'zod';
import { INTERVENTION_TYPE_VALUES } from '../../common/case-catalog';

const CreateCaseInterventionFields = z.object({
  // Two shapes are valid: a service rendered under a program ASSIGNED to the
  // case (both fields — the enrollment is the anchor), or an ad-hoc service the
  // case worked on its own (neither field). A program without its enrollment is
  // ambiguous, so the refine below refuses it.
  programId: z.string().uuid().optional(),
  // Typed service from the intervention catalog (spec §4.4) — a *service
  // rendered under a program*, so the service comes from that program's
  // `program_interventions` rows.
  interventionType: z.enum(INTERVENTION_TYPE_VALUES).nullable().optional(),
  // The program enrollment the service was delivered under — validated to
  // belong to this case (and to the named program). Absent = ad-hoc service.
  programEnrollmentId: z.string().uuid().optional(),
  serviceName: z.string().min(1),
  category: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  modeOfDelivery: z.string().nullable().optional(),
  fundSource: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deliveredBy: z.string().nullable().optional(),
});

/** Writes must pick a shape; a PATCH may legitimately touch one anchor only. */
export const CreateCaseInterventionSchema = CreateCaseInterventionFields.superRefine((value, ctx) => {
  if (value.programId && !value.programEnrollmentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['programEnrollmentId'],
      message: 'An intervention under a program needs its enrollment',
    });
  }
});

export const UpdateCaseInterventionSchema = CreateCaseInterventionFields.partial();

export type CreateCaseInterventionInput = z.infer<typeof CreateCaseInterventionSchema>;
export type UpdateCaseInterventionInput = z.infer<typeof UpdateCaseInterventionSchema>;