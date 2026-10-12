import { z } from 'zod';
import { INTERVENTION_TYPE_VALUES } from '../../common/case-catalog';

export const CreateCaseInterventionSchema = z.object({
  // An intervention is a service rendered under a program ASSIGNED to the case
  // (the treatment plan), so both the program and the enrollment are required.
  programId: z.string().uuid(),
  // Typed service from the intervention catalog (spec §4.4) — a *service
  // rendered under a program*, so the service comes from that program's
  // `program_interventions` rows.
  interventionType: z.enum(INTERVENTION_TYPE_VALUES).nullable().optional(),
  // The program enrollment the service was delivered under — validated to
  // belong to this case (and to the named program).
  programEnrollmentId: z.string().uuid(),
  serviceName: z.string().min(1),
  category: z.string().nullable().optional(),
  deliveryDate: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  modeOfDelivery: z.string().nullable().optional(),
  fundSource: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  deliveredBy: z.string().nullable().optional(),
});

export const UpdateCaseInterventionSchema = CreateCaseInterventionSchema.partial();

export type CreateCaseInterventionInput = z.infer<typeof CreateCaseInterventionSchema>;
export type UpdateCaseInterventionInput = z.infer<typeof UpdateCaseInterventionSchema>;