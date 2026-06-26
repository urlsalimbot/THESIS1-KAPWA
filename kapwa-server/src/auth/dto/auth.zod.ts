import { MIN_PASSWORD_LENGTH } from '../constants';
import { z } from 'zod';

export const UserCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
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

export const MfaSetupSchema = z.object({});

export const MfaEnableSchema = z.object({
  code: z.string().length(6),
});

export const MfaDisableSchema = z.object({
  password: z.string(),
});

export const OtpVerifySchema = z.object({
  tempToken: z.string(),
  otpCode: z.string().length(6),
});

export const MfaVerifySchema = z.object({
  tempToken: z.string(),
  code: z.string().length(6),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type MfaSetupInput = z.infer<typeof MfaSetupSchema>;
export type MfaEnableInput = z.infer<typeof MfaEnableSchema>;
export type MfaDisableInput = z.infer<typeof MfaDisableSchema>;
export type OtpVerifyInput = z.infer<typeof OtpVerifySchema>;
export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;
