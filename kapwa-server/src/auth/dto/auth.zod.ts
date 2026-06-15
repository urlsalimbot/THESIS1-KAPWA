import { z } from 'zod';

export const UserCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['social_worker', 'admin', 'coordinator', 'claimant', 'mayor', 'auditor']).default('social_worker'),
  fullName: z.string().optional(),
  phone: z.string().optional(),
  assignedBarangay: z.string().optional(),
  permittedBarangays: z.array(z.string()).optional()
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string()
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;