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

export const ChangePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
});

export const ChangeEmailSchema = z.object({
  newEmail: z.string().email(),
  currentPassword: z.string(),
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type ChangeEmailInput = z.infer<typeof ChangeEmailSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const ResendVerificationSchema = z.object({
  email: z.string().email(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const ConfirmEmailChangeSchema = z.object({
  token: z.string().min(1),
});

export const UpdatePhoneSchema = z.object({
  phone: z.string().min(10).max(15),
});

export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
export type ConfirmEmailChangeInput = z.infer<typeof ConfirmEmailChangeSchema>;
export type UpdatePhoneInput = z.infer<typeof UpdatePhoneSchema>;
