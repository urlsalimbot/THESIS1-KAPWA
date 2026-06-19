import { z } from 'zod';

export const UserRoleEnum = z.enum([
  'admin', 'social_worker', 'coordinator', 'claimant', 'mayor', 'auditor'
]);

export const CreateUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: UserRoleEnum,
  full_name: z.string().min(1).optional(),
  phone: z.string().optional(),
  assigned_barangay: z.string().optional(),
  permitted_barangays: z.array(z.string()).optional(),
}).strict();

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserSchema = z.object({
  fullName: z.string().optional(),
  role: z.string().optional(),
  isActive: z.boolean().optional(),
  assignedBarangay: z.string().optional(),
  permittedBarangays: z.array(z.string()).optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
