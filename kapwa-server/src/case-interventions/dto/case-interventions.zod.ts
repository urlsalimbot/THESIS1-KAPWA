import { z } from 'zod';
import { INTERVENTION_TYPE_VALUES } from '../../common/case-catalog';

export const CreateCaseInterventionSchema = z.object({
  programId: z.string().nullable().optional(),
  // Typed service from the intervention catalog (spec §4.4) — a *service
  // rendered under a program*, so when a program is chosen the service should
  // come from that program's `program_services` rows. Optional: legacy rows
  // and untyped quick logs render as "uncatalogued".
  interventionType: z.enum(INTERVENTION_TYPE_VALUES).nullable().optional(),
  // The program enrollment the service was delivered under — validated to
  // belong to this case (and, when programId is also sent, to that program).
  programEnrollmentId: z.string().uuid().nullable().optional(),
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