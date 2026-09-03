import { z } from 'zod';

export const UserRoleEnum = z.enum([
  'admin', 'social_worker', 'coordinator', 'claimant', 'mayor', 'auditor', 'agency_staff'
]);

export const CreateUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: UserRoleEnum,
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1).optional(),
  nameExtension: z.string().optional(),
  phone: z.string().optional(),
  assigned_barangay: z.string().optional(),
  permitted_barangays: z.array(z.string()).optional(),
  agency_id: z.string().uuid().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.role === 'agency_staff' && !data.agency_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['agency_id'],
      message: 'Agency is required for agency_staff users',
    });
  }
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  nameExtension: z.string().optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
  assignedBarangay: z.string().optional(),
  permittedBarangays: z.array(z.string()).optional(),
  agencyId: z.string().uuid().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
