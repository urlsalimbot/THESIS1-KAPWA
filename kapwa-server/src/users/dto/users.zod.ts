import { z } from 'zod';

export const UserRoleEnum = z.enum([
  'admin', 'social_worker', 'coordinator', 'claimant', 'mayor', 'auditor', 'agency_staff'
]);

export const CreateUserInputSchema = z.object({
  email: z.string().email(),
  // Password is generated server-side (temporary + forced reset); accepted
  // but ignored for backward compatibility.
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: UserRoleEnum,
  firstName: z.string().min(1).optional(),
  middleName: z.string().optional(),
  lastName: z.string().min(1).optional(),
  nameExtension: z.string().optional(),
  phone: z.string().optional(),
  // camelCase to match the admin UI payload and UsersService.createUser.
  assignedBarangay: z.string().optional(),
  permittedBarangays: z.array(z.string()).optional(),
  agencyId: z.string().uuid().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.role === 'agency_staff' && !data.agencyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['agencyId'],
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
  assignedBarangay: z.string().optional(),
  permittedBarangays: z.array(z.string()).optional(),
  agencyId: z.string().uuid().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
