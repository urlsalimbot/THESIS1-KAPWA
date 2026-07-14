import { z } from 'zod';

export const IntakeInputSchema = z.object({
  beneficiary: z.object({
    surname: z.string().min(1),
    firstName: z.string().min(1),
    middleName: z.string().optional(),
    gender: z.enum(['Male', 'Female']),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    barangay: z.string().min(1),
    purok: z.string().optional(),
    phone: z.string().optional(),
    category: z.enum(['Senior', 'PWD', 'Child', 'Solo Parent', 'Indigenous', 'Others']).optional(),
  }),
  familyMembers: z.array(z.object({
    fullName: z.string().min(1),
    relationship: z.string().min(1),
    age: z.number().int().min(0).optional(),
    occupation: z.string().optional(),
  })).optional(),
  case: z.object({
    serviceRequested: z.array(z.string()).optional(),
    requirementsChecklist: z.record(z.boolean()).optional(),
    assessedBy: z.string().optional(),
    assignedWorkerId: z.string().optional(),
  }),
});

export type IntakeInput = z.infer<typeof IntakeInputSchema>;
