import { BARANGAY_NAMES } from '../../common/constants';
import { z } from 'zod';

export const UserRoleEnum = z.enum([
  'admin', 'social_worker', 'coordinator', 'claimant'
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
  // Enum-checked against the Norzagaray barangay list: a typo here is copied
  // into access_card_services.source_barangay and silently orphans the rows.
  assignedBarangay: z.enum(BARANGAY_NAMES).optional(),
  permittedBarangays: z.array(z.enum(BARANGAY_NAMES)).optional(),
  agencyId: z.string().uuid().optional(),
}).strict();

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

export const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  nameExtension: z.string().optional(),
  role: z.string().optional(),
  assignedBarangay: z.enum(BARANGAY_NAMES).optional(),
  permittedBarangays: z.array(z.enum(BARANGAY_NAMES)).optional(),
  agencyId: z.string().uuid().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
